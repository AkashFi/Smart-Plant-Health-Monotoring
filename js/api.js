/**
 * Smart Plant Health Monitoring System - API Service Layer
 * 
 * Handles all REST communication with Java Spring Boot backend.
 * Provides a high-fidelity Demo Mode simulation when backend is not connected.
 */

class ApiService {
  constructor() {
    this.STORAGE_KEY_SETTINGS = 'flora_settings';
    this.STORAGE_KEY_PLANTS = 'flora_plants';
    this.STORAGE_KEY_ALERTS = 'flora_alerts';
    this.STORAGE_KEY_HISTORY = 'flora_history';
    this.STORAGE_KEY_READINGS = 'flora_readings';

    this.settings = this.loadSettings();
    this.initDemoDatabase();
  }

  // Load settings or defaults
  loadSettings() {
    const defaults = {
      apiUrl: 'http://localhost:8080/api',
      refreshInterval: 5000, // 5 seconds
      demoMode: true,        // Demo Mode active by default for initial review
      tempUnit: 'C',         // 'C' or 'F'
      lightMode: 'lux',      // 'lux' or 'adc'
      lightAdcMultiplier: 12.5, // Lux = ADC * multiplier (for 12-bit ADC 0-4095)
      freshnessTimeout: 30,  // Stale warning if > 30s without update
      audioNotifications: false,
      browserNotifications: false
    };

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY_SETTINGS);
      return stored ? { ...defaults, ...JSON.parse(stored) } : defaults;
    } catch (e) {
      console.warn('Error reading settings from localStorage, using defaults', e);
      return defaults;
    }
  }

  saveSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    localStorage.setItem(this.STORAGE_KEY_SETTINGS, JSON.stringify(this.settings));
    return this.settings;
  }

  isDemoMode() {
    return this.settings.demoMode;
  }

  getBaseUrl() {
    return this.settings.apiUrl.replace(/\/+$/, '');
  }

  // Centralized HTTP Fetch wrapper with Timeout & Error Handling
  async request(endpoint, options = {}) {
    const timeout = options.timeout || 6000;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    const url = `${this.getBaseUrl()}${endpoint}`;
    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(options.headers || {})
      },
      signal: controller.signal
    };

    try {
      const response = await fetch(url, config);
      clearTimeout(id);

      if (!response.ok) {
        let errorData = null;
        try {
          errorData = await response.json();
        } catch (_) {
          errorData = { message: response.statusText };
        }
        throw new Error(errorData.message || `HTTP error ${response.status}: ${response.statusText}`);
      }

      if (response.status === 204) {
        return null; // No Content
      }

      return await response.json();
    } catch (err) {
      clearTimeout(id);
      if (err.name === 'AbortError') {
        throw new Error(`Request to ${endpoint} timed out after ${timeout}ms. Check if Spring Boot backend is running.`);
      }
      throw err;
    }
  }

  // ===================================================================
  // REST API Methods (with Demo Interceptor)
  // ===================================================================

  // GET /plants
  async getPlants() {
    if (this.isDemoMode()) {
      return this.demoGetPlants();
    }
    return this.request('/plants');
  }

  // GET /plants/{id}
  async getPlant(id) {
    if (this.isDemoMode()) {
      const plants = this.demoGetPlants();
      const plant = plants.find(p => p.id === id);
      if (!plant) throw new Error(`Plant with ID ${id} not found`);
      return plant;
    }
    return this.request(`/plants/${id}`);
  }

  // POST /plants
  async createPlant(plantData) {
    if (this.isDemoMode()) {
      return this.demoCreatePlant(plantData);
    }
    return this.request('/plants', {
      method: 'POST',
      body: JSON.stringify(plantData)
    });
  }

  // PUT /plants/{id}
  async updatePlant(id, plantData) {
    if (this.isDemoMode()) {
      return this.demoUpdatePlant(id, plantData);
    }
    return this.request(`/plants/${id}`, {
      method: 'PUT',
      body: JSON.stringify(plantData)
    });
  }

  // DELETE /plants/{id}
  async deletePlant(id) {
    if (this.isDemoMode()) {
      return this.demoDeletePlant(id);
    }
    return this.request(`/plants/${id}`, {
      method: 'DELETE'
    });
  }

  // GET /plants/{id}/readings/latest
  async getLatestReading(plantId) {
    if (this.isDemoMode()) {
      return this.demoGetLatestReading(plantId);
    }
    return this.request(`/plants/${plantId}/readings/latest`);
  }

  // GET /plants/{id}/readings?from={timestamp}&to={timestamp}
  async getHistoricalReadings(plantId, from, to) {
    if (this.isDemoMode()) {
      return this.demoGetHistoricalReadings(plantId, from, to);
    }
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    return this.request(`/plants/${plantId}/readings?${params.toString()}`);
  }

  // POST /sensor-readings (ESP32 telemetry ingestion)
  async postSensorReading(reading) {
    if (this.isDemoMode()) {
      return this.demoPostSensorReading(reading);
    }
    return this.request('/sensor-readings', {
      method: 'POST',
      body: JSON.stringify(reading)
    });
  }

  // GET /alerts
  async getAlerts(params = {}) {
    if (this.isDemoMode()) {
      return this.demoGetAlerts(params);
    }
    const query = new URLSearchParams(params).toString();
    return this.request(`/alerts${query ? `?${query}` : ''}`);
  }

  // PATCH /alerts/{id}
  async updateAlert(id, patchData) {
    if (this.isDemoMode()) {
      return this.demoUpdateAlert(id, patchData);
    }
    return this.request(`/alerts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patchData)
    });
  }

  // GET /plants/{id}/history (or GET /history when plantId is null/all)
  async getHistory(plantId = null, params = {}) {
    if (this.isDemoMode()) {
      return this.demoGetHistory(plantId, params);
    }
    const query = new URLSearchParams(params).toString();
    const endpoint = plantId ? `/plants/${plantId}/history` : '/care-events';
    return this.request(`${endpoint}${query ? `?${query}` : ''}`);
  }

  // POST /plants/{id}/care-events
  async createCareEvent(plantId, eventData) {
    if (this.isDemoMode()) {
      return this.demoCreateCareEvent(plantId, eventData);
    }
    return this.request(`/plants/${plantId}/care-events`, {
      method: 'POST',
      body: JSON.stringify(eventData)
    });
  }

  // Test backend connection
  async testConnection() {
    const startTime = performance.now();
    try {
      const response = await this.request('/plants', { timeout: 4000 });
      const latency = Math.round(performance.now() - startTime);
      return { success: true, latency, data: response };
    } catch (err) {
      const latency = Math.round(performance.now() - startTime);
      return { success: false, latency, error: err.message };
    }
  }

  // ===================================================================
  // High-Fidelity Demo Mode Engine (Simulated IoT Environment)
  // ===================================================================

  initDemoDatabase() {
    // Initialize default demo plants if not present
    if (!localStorage.getItem(this.STORAGE_KEY_PLANTS)) {
      const initialPlants = [
        {
          id: 'PLANT-001',
          name: 'Roma Tomato',
          species: 'Solanum lycopersicum',
          type: 'Tomato',
          stage: 'Flowering & Fruiting',
          environment: 'Indoor Smart Greenhouse',
          image: 'assets/images/tomato.svg',
          lastWatered: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
          lastFertilized: new Date(Date.now() - 12 * 86400 * 1000).toISOString(),
          thresholds: {
            moistureMin: 55,
            moistureMax: 80,
            tempMin: 18,
            tempMax: 28,
            lightMinLux: 15000,
            lightMaxLux: 35000,
            lightMinAdc: 1200,
            lightMaxAdc: 3200
          },
          liveReading: {
            moisture: 38, // Intentionally low for realistic watering demo alert!
            temperature: 24.5,
            lightLux: 18500,
            lightAdc: 1480,
            timestamp: new Date().toISOString()
          }
        },
        {
          id: 'PLANT-002',
          name: 'Sweet Genovese Basil',
          species: 'Ocimum basilicum',
          type: 'Basil',
          stage: 'Vegetative',
          environment: 'Balcony Container Box',
          image: 'assets/images/basil.svg',
          lastWatered: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
          lastFertilized: new Date(Date.now() - 5 * 86400 * 1000).toISOString(),
          thresholds: {
            moistureMin: 50,
            moistureMax: 75,
            tempMin: 20,
            tempMax: 30,
            lightMinLux: 12000,
            lightMaxLux: 28000,
            lightMinAdc: 960,
            lightMaxAdc: 2400
          },
          liveReading: {
            moisture: 65,
            temperature: 23.2,
            lightLux: 21200,
            lightAdc: 1696,
            timestamp: new Date().toISOString()
          }
        },
        {
          id: 'PLANT-003',
          name: "Bird's Eye Hot Chilli",
          species: 'Capsicum frutescens',
          type: 'Chilli',
          stage: 'Fruiting',
          environment: 'Hydroponic Rack #2',
          image: 'assets/images/chilli.svg',
          lastWatered: new Date(Date.now() - 10 * 3600 * 1000).toISOString(),
          lastFertilized: new Date(Date.now() - 8 * 86400 * 1000).toISOString(),
          thresholds: {
            moistureMin: 45,
            moistureMax: 70,
            tempMin: 21,
            tempMax: 32,
            lightMinLux: 20000,
            lightMaxLux: 40000,
            lightMinAdc: 1600,
            lightMaxAdc: 3400
          },
          liveReading: {
            moisture: 58,
            temperature: 27.8,
            lightLux: 28500,
            lightAdc: 2280,
            timestamp: new Date().toISOString()
          }
        },
        {
          id: 'PLANT-004',
          name: 'Baby Leaf Spinach',
          species: 'Spinacia oleracea',
          type: 'Spinach',
          stage: 'Vegetative Harvest',
          environment: 'Vertical Farm Bed A',
          image: 'assets/images/spinach.svg',
          lastWatered: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
          lastFertilized: new Date(Date.now() - 3 * 86400 * 1000).toISOString(),
          thresholds: {
            moistureMin: 60,
            moistureMax: 85,
            tempMin: 14,
            tempMax: 22,
            lightMinLux: 8000,
            lightMaxLux: 18000,
            lightMinAdc: 640,
            lightMaxAdc: 1500
          },
          liveReading: {
            moisture: 72,
            temperature: 18.4,
            lightLux: 14200,
            lightAdc: 1136,
            timestamp: new Date().toISOString()
          }
        }
      ];
      localStorage.setItem(this.STORAGE_KEY_PLANTS, JSON.stringify(initialPlants));
    }

    // Initialize initial Alerts
    if (!localStorage.getItem(this.STORAGE_KEY_ALERTS)) {
      const initialAlerts = [
        {
          id: 'ALT-101',
          plantId: 'PLANT-001',
          plantName: 'Roma Tomato',
          severity: 'Critical',
          type: 'Watering',
          title: 'Low Soil Moisture Warning',
          message: 'Soil moisture has dropped to 38% (threshold: 55%). Tomato is entering root stress.',
          sensorValue: '38%',
          threshold: '55% - 80%',
          actionRecommended: 'Water with approximately 300ml of room-temperature water. Ensure drainage holes are unblocked.',
          actionTaken: null,
          status: 'Active',
          acknowledged: false,
          timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString()
        },
        {
          id: 'ALT-102',
          plantId: 'PLANT-003',
          plantName: "Bird's Eye Hot Chilli",
          severity: 'Warning',
          type: 'Fertilizer Reminder',
          title: 'Scheduled NPK Fertilizer Reminder',
          message: 'Chilli is in active fruiting stage and was last fertilized 8 days ago.',
          sensorValue: 'Schedule-based',
          threshold: 'Every 7-10 days',
          actionRecommended: 'Apply balanced potassium-rich organic fertilizer (NPK 5-10-10 or seaweed extract). Note: ESP32 moisture/temp sensors do not measure soil NPK directly.',
          actionTaken: null,
          status: 'Active',
          acknowledged: false,
          timestamp: new Date(Date.now() - 3 * 3600 * 1000).toISOString()
        },
        {
          id: 'ALT-103',
          plantId: 'PLANT-002',
          plantName: 'Sweet Genovese Basil',
          severity: 'Information',
          type: 'Optimal Conditions',
          title: 'Ideal Growth Conditions Maintained',
          message: 'Moisture, temperature, and light levels have remained within optimal ranges for 24 hours.',
          sensorValue: 'Moisture 65%, Temp 23.2°C',
          threshold: 'All in range',
          actionRecommended: 'Maintain regular care schedule.',
          actionTaken: 'Monitored',
          status: 'Resolved',
          acknowledged: true,
          timestamp: new Date(Date.now() - 20 * 3600 * 1000).toISOString()
        }
      ];
      localStorage.setItem(this.STORAGE_KEY_ALERTS, JSON.stringify(initialAlerts));
    }

    // Initialize Care History Log
    if (!localStorage.getItem(this.STORAGE_KEY_HISTORY)) {
      const initialHistory = [
        {
          id: 'EVT-501',
          plantId: 'PLANT-001',
          plantName: 'Roma Tomato',
          eventType: 'Watering',
          timestamp: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
          soilMoisture: 42,
          temperature: 23.5,
          lightReading: '17,200 lux',
          healthStatus: 'Needs Attention',
          actionTaken: 'Applied 400ml filtered water with slow soil drench',
          userNotes: 'Soil was feeling dry on the top 2 inches.',
          operator: 'Akash'
        },
        {
          id: 'EVT-502',
          plantId: 'PLANT-002',
          plantName: 'Sweet Genovese Basil',
          eventType: 'Fertilizer',
          timestamp: new Date(Date.now() - 5 * 86400 * 1000).toISOString(),
          soilMoisture: 68,
          temperature: 24.1,
          lightReading: '22,000 lux',
          healthStatus: 'Healthy',
          actionTaken: 'Applied organic liquid seaweed extract (5ml per liter)',
          userNotes: 'Promotes vibrant foliage growth and flavor aroma.',
          operator: 'Akash'
        },
        {
          id: 'EVT-503',
          plantId: 'PLANT-003',
          plantName: "Bird's Eye Hot Chilli",
          eventType: 'Pest Treatment',
          timestamp: new Date(Date.now() - 6 * 86400 * 1000).toISOString(),
          soilMoisture: 60,
          temperature: 28.0,
          lightReading: '31,000 lux',
          healthStatus: 'Healthy',
          actionTaken: 'Preventative neem oil spray applied to leaf undersides',
          userNotes: 'Reported mild whitefly observation earlier; isolated and sprayed. Note: ESP32 does not detect pests; logged from physical inspection.',
          operator: 'Akash'
        },
        {
          id: 'EVT-504',
          plantId: 'PLANT-004',
          plantName: 'Baby Leaf Spinach',
          eventType: 'Watering',
          timestamp: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
          soilMoisture: 72,
          temperature: 18.4,
          lightReading: '14,200 lux',
          healthStatus: 'Healthy',
          actionTaken: 'Automated drip reservoir top-up (200ml)',
          userNotes: 'Spinach bed moisture restored to optimal zone.',
          operator: 'Akash'
        },
        {
          id: 'EVT-505',
          plantId: 'PLANT-001',
          plantName: 'Roma Tomato',
          eventType: 'Plant Note',
          timestamp: new Date(Date.now() - 2 * 86400 * 1000).toISOString(),
          soilMoisture: 64,
          temperature: 25.1,
          lightReading: '24,500 lux',
          healthStatus: 'Healthy',
          actionTaken: 'Pruned lower suckers to encourage fruit development',
          userNotes: 'First flower clusters are beginning to set small green fruits.',
          operator: 'Akash'
        }
      ];
      localStorage.setItem(this.STORAGE_KEY_HISTORY, JSON.stringify(initialHistory));
    }
  }

  demoGetPlants() {
    const raw = localStorage.getItem(this.STORAGE_KEY_PLANTS);
    return raw ? JSON.parse(raw) : [];
  }

  demoCreatePlant(plantData) {
    const plants = this.demoGetPlants();
    const newId = `PLANT-${String(plants.length + 1).padStart(3, '0')}`;
    const newPlant = {
      id: newId,
      name: plantData.name || 'New Plant',
      species: plantData.species || 'Unknown',
      type: plantData.type || 'Custom',
      stage: plantData.stage || 'Vegetative',
      environment: plantData.environment || 'Indoor Greenhouse',
      image: plantData.image || 'assets/images/plant-placeholder.svg',
      lastWatered: new Date().toISOString(),
      lastFertilized: new Date().toISOString(),
      thresholds: {
        moistureMin: Number(plantData.moistureMin) || 50,
        moistureMax: Number(plantData.moistureMax) || 80,
        tempMin: Number(plantData.tempMin) || 18,
        tempMax: Number(plantData.tempMax) || 28,
        lightMinLux: Number(plantData.lightMinLux) || 10000,
        lightMaxLux: Number(plantData.lightMaxLux) || 30000,
        lightMinAdc: Number(plantData.lightMinAdc) || 800,
        lightMaxAdc: Number(plantData.lightMaxAdc) || 2600
      },
      liveReading: {
        moisture: 65,
        temperature: 23.5,
        lightLux: 18000,
        lightAdc: 1440,
        timestamp: new Date().toISOString()
      }
    };
    plants.push(newPlant);
    localStorage.setItem(this.STORAGE_KEY_PLANTS, JSON.stringify(plants));

    // Record creation event in history
    this.demoCreateCareEvent(newId, {
      eventType: 'Plant Note',
      actionTaken: 'Plant registered in monitoring system',
      userNotes: `Initial baseline configuration for ${newPlant.name}.`
    });

    return newPlant;
  }

  demoUpdatePlant(id, plantData) {
    const plants = this.demoGetPlants();
    const index = plants.findIndex(p => p.id === id);
    if (index === -1) throw new Error(`Plant ${id} not found`);

    plants[index] = {
      ...plants[index],
      ...plantData,
      thresholds: {
        ...plants[index].thresholds,
        ...(plantData.thresholds || {})
      }
    };
    localStorage.setItem(this.STORAGE_KEY_PLANTS, JSON.stringify(plants));
    return plants[index];
  }

  demoDeletePlant(id) {
    let plants = this.demoGetPlants();
    plants = plants.filter(p => p.id !== id);
    localStorage.setItem(this.STORAGE_KEY_PLANTS, JSON.stringify(plants));
    return { success: true, message: `Plant ${id} removed` };
  }

  // Generate or advance live reading with gentle realistic random-walk physics
  demoGetLatestReading(plantId) {
    const plants = this.demoGetPlants();
    const plant = plants.find(p => p.id === plantId);
    if (!plant) throw new Error(`Plant ${plantId} not found`);

    let reading = plant.liveReading || {
      moisture: 60,
      temperature: 24.0,
      lightLux: 18000,
      lightAdc: 1440,
      timestamp: new Date().toISOString()
    };

    // Realistic drift:
    // Moisture slowly dries up (-0.2% to +0.05%) unless watered
    const moistureDelta = (Math.random() * 0.3) - 0.22;
    const newMoisture = Math.max(10, Math.min(98, Math.round((reading.moisture + moistureDelta) * 10) / 10));

    // Temperature subtle swing (-0.2 to +0.2 deg C)
    const tempDelta = (Math.random() * 0.4) - 0.2;
    const newTemp = Math.round((reading.temperature + tempDelta) * 10) / 10;

    // Light subtle fluctuation (-300 to +300 lux)
    const lightDelta = Math.round((Math.random() * 600) - 300);
    const newLightLux = Math.max(0, Math.min(65000, reading.lightLux + lightDelta));
    const newLightAdc = Math.round(newLightLux / (this.settings.lightAdcMultiplier || 12.5));

    const updatedReading = {
      moisture: newMoisture,
      temperature: newTemp,
      lightLux: newLightLux,
      lightAdc: newLightAdc,
      timestamp: new Date().toISOString()
    };

    plant.liveReading = updatedReading;
    localStorage.setItem(this.STORAGE_KEY_PLANTS, JSON.stringify(plants));

    // Check alert threshold logic automatically in Demo mode
    this.demoEvaluateAlertThresholds(plant, updatedReading);

    return updatedReading;
  }

  // Automatic Alert Rule Engine for Demo Simulation (Anti-Spam)
  demoEvaluateAlertThresholds(plant, reading) {
    const alerts = this.demoGetAlerts();
    const t = plant.thresholds;

    // 1. Soil Moisture Alert
    if (reading.moisture < t.moistureMin) {
      const activeAlert = alerts.find(a => a.plantId === plant.id && a.type === 'Watering' && a.status === 'Active');
      if (!activeAlert) {
        const newAlert = {
          id: `ALT-${Date.now().toString().slice(-4)}`,
          plantId: plant.id,
          plantName: plant.name,
          severity: reading.moisture < (t.moistureMin - 15) ? 'Critical' : 'Warning',
          type: 'Watering',
          title: `Low Moisture: ${plant.name}`,
          message: `Soil moisture dropped to ${reading.moisture}% (recommended minimum: ${t.moistureMin}%).`,
          sensorValue: `${reading.moisture}%`,
          threshold: `${t.moistureMin}% - ${t.moistureMax}%`,
          actionRecommended: `Water with 250-350ml room-temperature water. Avoid flooding root zone.`,
          actionTaken: null,
          status: 'Active',
          acknowledged: false,
          timestamp: new Date().toISOString()
        };
        alerts.unshift(newAlert);
        localStorage.setItem(this.STORAGE_KEY_ALERTS, JSON.stringify(alerts));
      }
    }

    // 2. Temperature Alert
    if (reading.temperature < t.tempMin || reading.temperature > t.tempMax) {
      const activeAlert = alerts.find(a => a.plantId === plant.id && a.type === 'Temperature' && a.status === 'Active');
      if (!activeAlert) {
        const isHot = reading.temperature > t.tempMax;
        const newAlert = {
          id: `ALT-${Date.now().toString().slice(-4)}`,
          plantId: plant.id,
          plantName: plant.name,
          severity: 'Warning',
          type: 'Temperature',
          title: `${isHot ? 'High' : 'Low'} Temperature Alert`,
          message: `Temperature is ${reading.temperature}°C, outside recommended ${t.tempMin}°C - ${t.tempMax}°C.`,
          sensorValue: `${reading.temperature}°C`,
          threshold: `${t.tempMin}°C - ${t.tempMax}°C`,
          actionRecommended: isHot 
            ? 'Ventilate growing area, provide shade cloth, or check greenhouse cooling fan.'
            : 'Close draft vents or relocate closer to indoor warmth.',
          actionTaken: null,
          status: 'Active',
          acknowledged: false,
          timestamp: new Date().toISOString()
        };
        alerts.unshift(newAlert);
        localStorage.setItem(this.STORAGE_KEY_ALERTS, JSON.stringify(alerts));
      }
    }
  }

  // Generate realistic historical timeline for charts (1h, 24h, 7d, 30d)
  demoGetHistoricalReadings(plantId, from, to) {
    const plants = this.demoGetPlants();
    const plant = plants.find(p => p.id === plantId) || plants[0];
    const t = plant.thresholds;

    const fromDate = from ? new Date(from) : new Date(Date.now() - 24 * 3600 * 1000);
    const toDate = to ? new Date(to) : new Date();

    const diffHours = Math.max(1, (toDate - fromDate) / (3600 * 1000));
    
    // Choose step size based on duration
    let steps = 24;
    if (diffHours <= 1.5) steps = 20; // 1 hour: 3 min intervals
    else if (diffHours <= 26) steps = 26; // 24 hours: 1 hr intervals
    else if (diffHours <= 180) steps = 35; // 7 days: ~5 hr intervals
    else steps = 45; // 30 days: daily intervals

    const stepMs = (toDate - fromDate) / steps;
    const readings = [];

    // Base values around plant's optimal range
    const baseMoisture = (t.moistureMin + t.moistureMax) / 2;
    const baseTemp = (t.tempMin + t.tempMax) / 2;
    const baseLight = (t.lightMinLux + t.lightMaxLux) / 2;

    for (let i = 0; i <= steps; i++) {
      const time = new Date(fromDate.getTime() + (i * stepMs));
      const hour = time.getHours();

      // Diurnal temperature wave (cooler at night, warmer in mid-afternoon)
      const dayFactor = Math.sin(((hour - 8) / 24) * Math.PI * 2);
      const temp = Math.round((baseTemp + (dayFactor * 3.5) + ((Math.random() - 0.5) * 0.8)) * 10) / 10;

      // Diurnal sunlight wave (zero/low at night, peak at 13:00)
      let lightLux = 0;
      if (hour >= 6 && hour <= 19) {
        const sunIntensity = Math.sin(((hour - 6) / 13) * Math.PI);
        lightLux = Math.round(baseLight * sunIntensity * (0.8 + Math.random() * 0.4));
      } else {
        lightLux = Math.round(150 + Math.random() * 200); // Ambient room light
      }
      const lightAdc = Math.round(lightLux / (this.settings.lightAdcMultiplier || 12.5));

      // Moisture sawtooth: slowly decreases, with intermittent watering spikes
      const cyclePos = (i % 12) / 12; // simulated watering every ~12 steps
      const moisture = Math.round(Math.max(25, Math.min(95, baseMoisture + 15 - (cyclePos * 25) + ((Math.random() - 0.5) * 3))));

      readings.push({
        id: `REC-${i}`,
        plantId: plant.id,
        moisture,
        temperature: temp,
        lightLux,
        lightAdc,
        timestamp: time.toISOString()
      });
    }

    return readings;
  }

  demoPostSensorReading(reading) {
    const plants = this.demoGetPlants();
    const plant = plants.find(p => p.id === reading.plantId);
    if (!plant) throw new Error(`Plant ${reading.plantId} not found`);

    plant.liveReading = {
      moisture: Number(reading.moisture),
      temperature: Number(reading.temperature),
      lightLux: Number(reading.lightLux || (reading.lightAdc * (this.settings.lightAdcMultiplier || 12.5))),
      lightAdc: Number(reading.lightAdc || Math.round(reading.lightLux / (this.settings.lightAdcMultiplier || 12.5))),
      timestamp: reading.timestamp || new Date().toISOString()
    };

    localStorage.setItem(this.STORAGE_KEY_PLANTS, JSON.stringify(plants));
    this.demoEvaluateAlertThresholds(plant, plant.liveReading);
    return { status: 'SUCCESS', reading: plant.liveReading };
  }

  demoGetAlerts(params = {}) {
    const raw = localStorage.getItem(this.STORAGE_KEY_ALERTS);
    let alerts = raw ? JSON.parse(raw) : [];

    if (params.plantId && params.plantId !== 'all') {
      alerts = alerts.filter(a => a.plantId === params.plantId);
    }
    if (params.severity && params.severity !== 'all') {
      alerts = alerts.filter(a => a.severity.toLowerCase() === params.severity.toLowerCase());
    }
    if (params.status && params.status !== 'all') {
      alerts = alerts.filter(a => a.status.toLowerCase() === params.status.toLowerCase());
    }

    return alerts;
  }

  demoUpdateAlert(id, patchData) {
    const alerts = this.demoGetAlerts();
    const index = alerts.findIndex(a => a.id === id);
    if (index === -1) throw new Error(`Alert ${id} not found`);

    alerts[index] = {
      ...alerts[index],
      ...patchData,
      resolvedAt: patchData.status === 'Resolved' ? new Date().toISOString() : alerts[index].resolvedAt
    };

    localStorage.setItem(this.STORAGE_KEY_ALERTS, JSON.stringify(alerts));
    return alerts[index];
  }

  demoGetHistory(plantId = null, params = {}) {
    const raw = localStorage.getItem(this.STORAGE_KEY_HISTORY);
    let history = raw ? JSON.parse(raw) : [];

    if (plantId && plantId !== 'all') {
      history = history.filter(h => h.plantId === plantId);
    }
    if (params.eventType && params.eventType !== 'all') {
      history = history.filter(h => h.eventType.toLowerCase() === params.eventType.toLowerCase());
    }

    // Sort newest first
    return history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  demoCreateCareEvent(plantId, eventData) {
    const plants = this.demoGetPlants();
    const plant = plants.find(p => p.id === plantId);
    const plantName = plant ? plant.name : 'All Plants';
    const reading = plant ? plant.liveReading : null;

    const history = this.demoGetHistory();
    const newEvent = {
      id: `EVT-${Date.now().toString().slice(-4)}`,
      plantId: plantId || 'SYSTEM',
      plantName,
      eventType: eventData.eventType || 'Care Action',
      timestamp: eventData.timestamp || new Date().toISOString(),
      soilMoisture: reading ? reading.moisture : '--',
      temperature: reading ? reading.temperature : '--',
      lightReading: reading ? `${reading.lightLux.toLocaleString()} lux` : '--',
      healthStatus: eventData.healthStatus || 'Healthy',
      actionTaken: eventData.actionTaken || 'Recorded Care Action',
      userNotes: eventData.userNotes || '',
      waterAmount: eventData.waterAmount || null,
      fertilizerProduct: eventData.fertilizerProduct || null,
      treatmentDetails: eventData.treatmentDetails || null,
      operator: 'User'
    };

    history.unshift(newEvent);
    localStorage.setItem(this.STORAGE_KEY_HISTORY, JSON.stringify(history));

    // Update plant last watered / fertilized timestamp
    if (plant) {
      if (eventData.eventType === 'Watering') {
        plant.lastWatered = newEvent.timestamp;
        // Bump moisture for realism after watering
        if (plant.liveReading) {
          plant.liveReading.moisture = Math.min(85, plant.liveReading.moisture + 35);
        }
      } else if (eventData.eventType === 'Fertilizer') {
        plant.lastFertilized = newEvent.timestamp;
      }
      localStorage.setItem(this.STORAGE_KEY_PLANTS, JSON.stringify(plants));
    }

    return newEvent;
  }
}

// Global API Service instance
window.api = new ApiService();
