/**
 * Smart Plant Health Monitoring System - Plants Manager
 */

class PlantsController {
  constructor() {
    this.plants = [];
  }

  async init() {
    this.bindEvents();
    await this.loadPlants();
  }

  bindEvents() {
    // Add Plant button
    document.getElementById('btn-add-plant')?.addEventListener('click', () => {
      this.openAddPlantModal();
    });

    // Preset selection change in Add/Edit modal
    const presetSelect = document.getElementById('plant-preset-select');
    if (presetSelect) {
      presetSelect.addEventListener('change', (e) => {
        this.applyPreset(e.target.value);
      });
    }

    // Plant form submission
    const form = document.getElementById('plant-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleFormSubmit();
      });
    }
  }

  async loadPlants() {
    try {
      this.plants = await window.api.getPlants();
      this.renderPlantsGrid();
    } catch (err) {
      console.error('Failed to load plants:', err);
      window.app.showToast('Failed to load plants', 'error');
    }
  }

  renderPlantsGrid() {
    const grid = document.getElementById('plants-grid-container');
    if (!grid) return;

    if (this.plants.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state-icon">🌱</div>
          <h3>No Plants Registered</h3>
          <p>Get started by adding your first plant profile and sensor parameters.</p>
          <button class="btn btn-primary" onclick="window.plants.openAddPlantModal()">+ Add New Plant</button>
        </div>
      `;
      return;
    }

    grid.innerHTML = this.plants.map(plant => {
      const reading = plant.liveReading || { moisture: '--', temperature: '--', lightLux: '--' };
      const t = plant.thresholds;
      
      // Calculate mini health badge
      let health = 'Healthy';
      let badgeClass = 'badge-healthy';
      if (typeof reading.moisture === 'number') {
        if (reading.moisture < t.moistureMin || reading.moisture > t.moistureMax ||
            reading.temperature < t.tempMin || reading.temperature > t.tempMax) {
          health = reading.moisture < (t.moistureMin - 15) ? 'Critical' : 'Needs Attention';
          badgeClass = health === 'Critical' ? 'badge-critical' : 'badge-needs-attention';
        }
      }

      const lastWateredStr = plant.lastWatered ? new Date(plant.lastWatered).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never';

      return `
        <div class="plant-card">
          <div class="plant-card-top">
            <div class="plant-card-thumb">
              <img src="${plant.image || 'assets/images/plant-placeholder.svg'}" alt="${plant.name}" />
            </div>
            <div class="plant-card-title">
              <h3>${plant.name}</h3>
              <div class="plant-card-species">${plant.species} • <span class="plant-id-badge">${plant.id}</span></div>
            </div>
            <div class="plant-card-health-pill">
              <span class="metric-status-badge ${badgeClass}">${health}</span>
            </div>
          </div>

          <div class="plant-card-body">
            <div style="font-size: 0.8rem; color: var(--text-muted); display: flex; justify-content: space-between;">
              <span><strong>Stage:</strong> ${plant.stage}</span>
              <span><strong>Env:</strong> ${plant.environment}</span>
            </div>

            <!-- Mini Live Gauges -->
            <div class="plant-metrics-row">
              <div class="mini-metric">
                <span class="label">Moisture</span>
                <span class="val" style="color: #0284c7;">${reading.moisture}%</span>
              </div>
              <div class="mini-metric">
                <span class="label">Temperature</span>
                <span class="val" style="color: #ea580c;">${reading.temperature}°C</span>
              </div>
              <div class="mini-metric">
                <span class="label">Light</span>
                <span class="val" style="color: #ca8a04;">${typeof reading.lightLux === 'number' ? `${Math.round(reading.lightLux / 1000)}k` : '--'} lx</span>
              </div>
            </div>

            <div class="plant-meta-info">
              <span>💧 Last watered: ${lastWateredStr}</span>
            </div>
          </div>

          <div class="plant-card-actions">
            <button class="btn btn-sm btn-primary" onclick="window.plants.selectForMonitoring('${plant.id}')" style="flex: 1;">
              Monitor Live
            </button>
            <button class="btn btn-sm btn-secondary" onclick="window.app.openWateringModal('${plant.id}')" title="Log Watering">
              💧
            </button>
            <button class="btn btn-sm btn-secondary" onclick="window.plants.openEditPlantModal('${plant.id}')" title="Edit Plant">
              ✏️
            </button>
            <button class="btn btn-sm btn-secondary" onclick="window.plants.confirmDeletePlant('${plant.id}', '${plant.name}')" title="Delete Plant" style="color: var(--danger-600);">
              🗑️
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  selectForMonitoring(plantId) {
    window.dashboard.selectedPlantId = plantId;
    window.location.hash = '#dashboard';
    window.dashboard.populatePlantSelector();
    window.dashboard.refreshData();
    window.app.showToast(`Switched active monitor to ${plantId}`, 'info');
  }

  // Plant Presets for quick standard horticultural setup
  getPresets() {
    return {
      tomato: {
        name: 'Roma Tomato',
        species: 'Solanum lycopersicum',
        type: 'Tomato',
        stage: 'Flowering & Fruiting',
        environment: 'Indoor Smart Greenhouse',
        image: 'assets/images/tomato.svg',
        moistureMin: 55,
        moistureMax: 80,
        tempMin: 18,
        tempMax: 28,
        lightMinLux: 15000,
        lightMaxLux: 35000,
        lightMinAdc: 1200,
        lightMaxAdc: 3200
      },
      basil: {
        name: 'Sweet Genovese Basil',
        species: 'Ocimum basilicum',
        type: 'Basil',
        stage: 'Vegetative',
        environment: 'Balcony Container Box',
        image: 'assets/images/basil.svg',
        moistureMin: 50,
        moistureMax: 75,
        tempMin: 20,
        tempMax: 30,
        lightMinLux: 12000,
        lightMaxLux: 28000,
        lightMinAdc: 960,
        lightMaxAdc: 2400
      },
      chilli: {
        name: "Bird's Eye Hot Chilli",
        species: 'Capsicum frutescens',
        type: 'Chilli',
        stage: 'Fruiting',
        environment: 'Hydroponic Rack #2',
        image: 'assets/images/chilli.svg',
        moistureMin: 45,
        moistureMax: 70,
        tempMin: 21,
        tempMax: 32,
        lightMinLux: 20000,
        lightMaxLux: 40000,
        lightMinAdc: 1600,
        lightMaxAdc: 3400
      },
      spinach: {
        name: 'Baby Leaf Spinach',
        species: 'Spinacia oleracea',
        type: 'Spinach',
        stage: 'Vegetative Harvest',
        environment: 'Vertical Farm Bed A',
        image: 'assets/images/spinach.svg',
        moistureMin: 60,
        moistureMax: 85,
        tempMin: 14,
        tempMax: 22,
        lightMinLux: 8000,
        lightMaxLux: 18000,
        lightMinAdc: 640,
        lightMaxAdc: 1500
      },
      mint: {
        name: 'Spearmint Herbal',
        species: 'Mentha spicata',
        type: 'Mint',
        stage: 'Vegetative',
        environment: 'Window Box Planter',
        image: 'assets/images/mint.svg',
        moistureMin: 55,
        moistureMax: 85,
        tempMin: 16,
        tempMax: 26,
        lightMinLux: 10000,
        lightMaxLux: 25000,
        lightMinAdc: 800,
        lightMaxAdc: 2200
      }
    };
  }

  applyPreset(presetKey) {
    const presets = this.getPresets();
    const data = presets[presetKey];
    if (!data) return;

    document.getElementById('plant-name-input').value = data.name;
    document.getElementById('plant-species-input').value = data.species;
    document.getElementById('plant-type-input').value = data.type;
    document.getElementById('plant-stage-input').value = data.stage;
    document.getElementById('plant-env-input').value = data.environment;
    document.getElementById('plant-image-input').value = data.image;

    document.getElementById('plant-moist-min').value = data.moistureMin;
    document.getElementById('plant-moist-max').value = data.moistureMax;
    document.getElementById('plant-temp-min').value = data.tempMin;
    document.getElementById('plant-temp-max').value = data.tempMax;
    document.getElementById('plant-light-min').value = data.lightMinLux;
    document.getElementById('plant-light-max').value = data.lightMaxLux;
  }

  openAddPlantModal() {
    document.getElementById('plant-modal-title').textContent = 'Register New Plant Profile';
    document.getElementById('plant-id-input').value = '';
    document.getElementById('plant-form').reset();
    document.getElementById('plant-preset-select').value = '';
    window.app.openModal('plant-modal');
  }

  async openEditPlantModal(plantId) {
    const plant = await window.api.getPlant(plantId);
    if (!plant) return;

    document.getElementById('plant-modal-title').textContent = `Edit Plant: ${plant.name}`;
    document.getElementById('plant-id-input').value = plant.id;
    document.getElementById('plant-name-input').value = plant.name;
    document.getElementById('plant-species-input').value = plant.species;
    document.getElementById('plant-type-input').value = plant.type;
    document.getElementById('plant-stage-input').value = plant.stage;
    document.getElementById('plant-env-input').value = plant.environment;
    document.getElementById('plant-image-input').value = plant.image || '';

    const t = plant.thresholds;
    document.getElementById('plant-moist-min').value = t.moistureMin;
    document.getElementById('plant-moist-max').value = t.moistureMax;
    document.getElementById('plant-temp-min').value = t.tempMin;
    document.getElementById('plant-temp-max').value = t.tempMax;
    document.getElementById('plant-light-min').value = t.lightMinLux;
    document.getElementById('plant-light-max').value = t.lightMaxLux;

    window.app.openModal('plant-modal');
  }

  async handleFormSubmit() {
    const id = document.getElementById('plant-id-input').value;
    const name = document.getElementById('plant-name-input').value.trim();
    const species = document.getElementById('plant-species-input').value.trim();
    const type = document.getElementById('plant-type-input').value.trim();
    const stage = document.getElementById('plant-stage-input').value;
    const environment = document.getElementById('plant-env-input').value;
    const image = document.getElementById('plant-image-input').value.trim() || 'assets/images/plant-placeholder.svg';

    const moistMin = Number(document.getElementById('plant-moist-min').value);
    const moistMax = Number(document.getElementById('plant-moist-max').value);
    const tempMin = Number(document.getElementById('plant-temp-min').value);
    const tempMax = Number(document.getElementById('plant-temp-max').value);
    const lightMin = Number(document.getElementById('plant-light-min').value);
    const lightMax = Number(document.getElementById('plant-light-max').value);

    // Validation
    if (!name) {
      window.app.showToast('Please enter a valid plant name', 'error');
      return;
    }
    if (moistMin >= moistMax || moistMin < 0 || moistMax > 100) {
      window.app.showToast('Moisture range must be between 0% and 100%, and Min < Max', 'error');
      return;
    }
    if (tempMin >= tempMax) {
      window.app.showToast('Temperature Min must be strictly less than Max', 'error');
      return;
    }

    const payload = {
      name,
      species,
      type,
      stage,
      environment,
      image,
      thresholds: {
        moistureMin: moistMin,
        moistureMax: moistMax,
        tempMin: tempMin,
        tempMax: tempMax,
        lightMinLux: lightMin,
        lightMaxLux: lightMax,
        lightMinAdc: Math.round(lightMin / 12.5),
        lightMaxAdc: Math.round(lightMax / 12.5)
      }
    };

    try {
      if (id) {
        await window.api.updatePlant(id, payload);
        window.app.showToast(`Updated plant ${name}`, 'success');
      } else {
        await window.api.createPlant(payload);
        window.app.showToast(`Registered new plant ${name}`, 'success');
      }

      window.app.closeModal('plant-modal');
      await this.loadPlants();
      await window.dashboard.populatePlantSelector();
    } catch (err) {
      console.error('Error saving plant:', err);
      window.app.showToast(err.message, 'error');
    }
  }

  confirmDeletePlant(plantId, plantName) {
    document.getElementById('delete-plant-name-label').textContent = `${plantName} (${plantId})`;
    document.getElementById('btn-confirm-delete').onclick = async () => {
      try {
        await window.api.deletePlant(plantId);
        window.app.closeModal('delete-plant-modal');
        window.app.showToast(`Deleted plant ${plantName}`, 'info');
        await this.loadPlants();
        await window.dashboard.populatePlantSelector();
      } catch (err) {
        window.app.showToast(err.message, 'error');
      }
    };
    window.app.openModal('delete-plant-modal');
  }
}

window.plants = new PlantsController();
