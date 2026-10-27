/**
 * Smart Plant Health Monitoring System - Settings Page Controller
 */

class SettingsController {
  constructor() {
    this.selectedThresholdPlantId = 'PLANT-001';
  }

  async init() {
    this.loadCurrentSettingsIntoForm();
    await this.populateThresholdPlantSelector();
    this.bindEvents();
  }

  loadCurrentSettingsIntoForm() {
    const s = window.api.settings;

    // Backend URL
    const urlInput = document.getElementById('setting-api-url');
    if (urlInput) urlInput.value = s.apiUrl || 'http://localhost:8080/api';

    // Refresh interval
    const refreshSelect = document.getElementById('setting-refresh-interval');
    if (refreshSelect) refreshSelect.value = s.refreshInterval || 5000;

    // Demo Mode toggle
    const demoToggle = document.getElementById('setting-demo-mode');
    if (demoToggle) demoToggle.checked = !!s.demoMode;

    // Units
    const tempUnit = document.getElementById('setting-temp-unit');
    if (tempUnit) tempUnit.value = s.tempUnit || 'C';

    const lightMode = document.getElementById('setting-light-mode');
    if (lightMode) lightMode.value = s.lightMode || 'lux';

    const adcMult = document.getElementById('setting-adc-multiplier');
    if (adcMult) adcMult.value = s.lightAdcMultiplier || 12.5;

    // Freshness timeout
    const freshnessInput = document.getElementById('setting-freshness-timeout');
    if (freshnessInput) freshnessInput.value = s.freshnessTimeout || 30;

    // Notification toggles
    const audioToggle = document.getElementById('setting-audio-chime');
    if (audioToggle) audioToggle.checked = !!s.audioNotifications;

    const browserNotifToggle = document.getElementById('setting-browser-notif');
    if (browserNotifToggle) browserNotifToggle.checked = !!s.browserNotifications;
  }

  async populateThresholdPlantSelector() {
    try {
      const plants = await window.api.getPlants();
      const select = document.getElementById('setting-threshold-plant');
      if (!select) return;

      select.innerHTML = '';
      plants.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.name} (${p.id})`;
        if (p.id === this.selectedThresholdPlantId) opt.selected = true;
        select.appendChild(opt);
      });

      this.loadPlantThresholdsIntoInputs(this.selectedThresholdPlantId);
    } catch (e) {
      console.error('Error populating threshold plant select:', e);
    }
  }

  async loadPlantThresholdsIntoInputs(plantId) {
    try {
      const plant = await window.api.getPlant(plantId);
      if (!plant) return;

      const t = plant.thresholds;
      document.getElementById('set-moist-min').value = t.moistureMin;
      document.getElementById('set-moist-max').value = t.moistureMax;
      document.getElementById('set-temp-min').value = t.tempMin;
      document.getElementById('set-temp-max').value = t.tempMax;
      document.getElementById('set-light-min').value = t.lightMinLux;
      document.getElementById('set-light-max').value = t.lightMaxLux;
    } catch (e) {
      console.error('Error loading plant thresholds:', e);
    }
  }

  bindEvents() {
    // Save Settings form
    document.getElementById('settings-general-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveGeneralSettings();
    });

    // Test Backend Connection
    document.getElementById('btn-test-connection')?.addEventListener('click', () => {
      this.runConnectionTest();
    });

    // Plant Thresholds select change
    const thresholdSelect = document.getElementById('setting-threshold-plant');
    if (thresholdSelect) {
      thresholdSelect.addEventListener('change', (e) => {
        this.selectedThresholdPlantId = e.target.value;
        this.loadPlantThresholdsIntoInputs(this.selectedThresholdPlantId);
      });
    }

    // Save Plant Thresholds
    document.getElementById('btn-save-thresholds')?.addEventListener('click', () => {
      this.savePlantThresholds();
    });

    // Reset Defaults
    document.getElementById('btn-reset-defaults')?.addEventListener('click', () => {
      this.resetToDefaults();
    });

    // Demo Mode toggle change immediately syncs
    const demoToggle = document.getElementById('setting-demo-mode');
    if (demoToggle) {
      demoToggle.addEventListener('change', (e) => {
        window.api.saveSettings({ demoMode: e.target.checked });
        window.app.updateDemoModeUI();
        window.app.showToast(
          e.target.checked ? 'Demo Mode enabled (simulated data active)' : 'Live Mode enabled (connecting to Spring Boot backend)',
          'info'
        );
      });
    }
  }

  saveGeneralSettings() {
    const apiUrl = document.getElementById('setting-api-url').value.trim();
    const refreshInterval = Number(document.getElementById('setting-refresh-interval').value);
    const demoMode = document.getElementById('setting-demo-mode').checked;
    const tempUnit = document.getElementById('setting-temp-unit').value;
    const lightMode = document.getElementById('setting-light-mode').value;
    const lightAdcMultiplier = Number(document.getElementById('setting-adc-multiplier').value) || 12.5;
    const freshnessTimeout = Number(document.getElementById('setting-freshness-timeout').value) || 30;
    const audioNotifications = document.getElementById('setting-audio-chime').checked;
    const browserNotifications = document.getElementById('setting-browser-notif').checked;

    if (!apiUrl) {
      window.app.showToast('Please specify a valid backend API URL', 'error');
      return;
    }

    window.api.saveSettings({
      apiUrl,
      refreshInterval,
      demoMode,
      tempUnit,
      lightMode,
      lightAdcMultiplier,
      freshnessTimeout,
      audioNotifications,
      browserNotifications
    });

    window.app.updateDemoModeUI();
    window.dashboard.startPolling();
    window.dashboard.refreshData();
    window.app.showToast('Settings saved successfully', 'success');
  }

  async runConnectionTest() {
    const resultBox = document.getElementById('connection-test-result');
    if (!resultBox) return;

    resultBox.style.display = 'block';
    resultBox.className = 'connection-pill connecting';
    resultBox.innerHTML = '<span class="status-dot"></span> Pinging Spring Boot API endpoint...';

    // Temporarily disable demo mode for the test if user wants to probe real backend
    const prevDemo = window.api.settings.demoMode;
    window.api.settings.demoMode = false;

    const res = await window.api.testConnection();
    window.api.settings.demoMode = prevDemo;

    if (res.success) {
      resultBox.className = 'connection-pill connected';
      resultBox.innerHTML = `
        <span class="status-dot"></span>
        Backend Connected! (${res.latency}ms latency) - Spring Boot API healthy.
      `;
    } else {
      resultBox.className = 'connection-pill disconnected';
      resultBox.innerHTML = `
        <span class="status-dot"></span>
        Connection Failed (${res.latency}ms): ${res.error}
      `;
    }
  }

  async savePlantThresholds() {
    const moistMin = Number(document.getElementById('set-moist-min').value);
    const moistMax = Number(document.getElementById('set-moist-max').value);
    const tempMin = Number(document.getElementById('set-temp-min').value);
    const tempMax = Number(document.getElementById('set-temp-max').value);
    const lightMin = Number(document.getElementById('set-light-min').value);
    const lightMax = Number(document.getElementById('set-light-max').value);

    if (moistMin >= moistMax || moistMin < 0 || moistMax > 100) {
      window.app.showToast('Invalid moisture range: must be 0-100% and Min < Max', 'error');
      return;
    }
    if (tempMin >= tempMax) {
      window.app.showToast('Temperature Min must be less than Max', 'error');
      return;
    }

    try {
      const plant = await window.api.getPlant(this.selectedThresholdPlantId);
      plant.thresholds = {
        moistureMin: moistMin,
        moistureMax: moistMax,
        tempMin: tempMin,
        tempMax: tempMax,
        lightMinLux: lightMin,
        lightMaxLux: lightMax,
        lightMinAdc: Math.round(lightMin / (window.api.settings.lightAdcMultiplier || 12.5)),
        lightMaxAdc: Math.round(lightMax / (window.api.settings.lightAdcMultiplier || 12.5))
      };

      await window.api.updatePlant(plant.id, plant);
      window.app.showToast(`Updated threshold rules for ${plant.name}`, 'success');
      await window.dashboard.refreshData();
    } catch (err) {
      window.app.showToast(err.message, 'error');
    }
  }

  resetToDefaults() {
    if (confirm('Are you sure you want to restore default configuration and sample plants?')) {
      localStorage.removeItem(window.api.STORAGE_KEY_SETTINGS);
      localStorage.removeItem(window.api.STORAGE_KEY_PLANTS);
      localStorage.removeItem(window.api.STORAGE_KEY_ALERTS);
      localStorage.removeItem(window.api.STORAGE_KEY_HISTORY);

      window.api.settings = window.api.loadSettings();
      window.api.initDemoDatabase();

      this.loadCurrentSettingsIntoForm();
      this.populateThresholdPlantSelector();
      window.app.updateDemoModeUI();
      window.dashboard.refreshData();
      window.app.showToast('Reset all settings to default factory values', 'info');
    }
  }
}

window.settings = new SettingsController();
