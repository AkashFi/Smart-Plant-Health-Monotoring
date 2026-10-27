/**
 * Smart Plant Health Monitoring System - Dashboard & Live Monitoring Controller
 */

class DashboardController {
  constructor() {
    this.selectedPlantId = 'PLANT-001';
    this.pollTimer = null;
    this.isPolling = false;
    this.sparklineChart = null;
  }

  async init() {
    await this.populatePlantSelector();
    this.bindEvents();
    await this.refreshData();
    this.startPolling();
  }

  bindEvents() {
    // Plant dropdown change
    const selector = document.getElementById('dashboard-plant-select');
    if (selector) {
      selector.addEventListener('change', (e) => {
        this.selectedPlantId = e.target.value;
        this.refreshData();
      });
    }

    // Refresh button
    const refreshBtn = document.getElementById('global-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.triggerManualRefresh();
      });
    }

    // Quick care action buttons on dashboard
    document.getElementById('action-record-water')?.addEventListener('click', () => {
      window.app.openWateringModal(this.selectedPlantId);
    });
    document.getElementById('action-record-fertilizer')?.addEventListener('click', () => {
      window.app.openFertilizerModal(this.selectedPlantId);
    });
    document.getElementById('action-record-pest')?.addEventListener('click', () => {
      window.app.openPestModal(this.selectedPlantId);
    });
    document.getElementById('action-add-note')?.addEventListener('click', () => {
      window.app.openNoteModal(this.selectedPlantId);
    });
    document.getElementById('action-view-history')?.addEventListener('click', () => {
      window.location.hash = '#care-log';
    });
    document.getElementById('action-edit-settings')?.addEventListener('click', () => {
      window.location.hash = '#settings';
    });
  }

  async populatePlantSelector() {
    try {
      const plants = await window.api.getPlants();
      const selector = document.getElementById('dashboard-plant-select');
      if (!selector) return;

      selector.innerHTML = '';
      plants.forEach(plant => {
        const opt = document.createElement('option');
        opt.value = plant.id;
        opt.textContent = `${plant.name} (${plant.id})`;
        if (plant.id === this.selectedPlantId) {
          opt.selected = true;
        }
        selector.appendChild(opt);
      });

      // Update global summary chips
      document.getElementById('summary-total-plants').textContent = `${plants.length} Plants`;
    } catch (err) {
      console.error('Error populating plant selector:', err);
    }
  }

  async triggerManualRefresh() {
    const refreshIcon = document.getElementById('global-refresh-icon');
    if (refreshIcon) refreshIcon.classList.add('spin-anim');

    window.app.setConnectionStatus('connecting');
    await this.refreshData();

    setTimeout(() => {
      if (refreshIcon) refreshIcon.classList.remove('spin-anim');
      window.app.setConnectionStatus('connected');
    }, 400);
  }

  startPolling() {
    this.stopPolling();
    const interval = window.api.settings.refreshInterval || 5000;
    if (interval <= 0) return; // Polling disabled

    this.pollTimer = setInterval(async () => {
      if (!this.isPolling) {
        this.isPolling = true;
        try {
          await this.pollLatestReading();
        } catch (e) {
          console.warn('Polling error:', e);
          window.app.setConnectionStatus('disconnected');
        } finally {
          this.isPolling = false;
        }
      }
    }, interval);
  }

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async refreshData() {
    try {
      const plant = await window.api.getPlant(this.selectedPlantId);
      const reading = await window.api.getLatestReading(this.selectedPlantId);
      const alerts = await window.api.getAlerts({ plantId: this.selectedPlantId, status: 'Active' });

      this.renderPlantHero(plant);
      this.renderMetricCards(plant, reading);
      this.renderActiveAlerts(alerts);
      this.renderTelemetrySparkline();
      this.checkFreshness(reading.timestamp);

      window.app.setConnectionStatus('connected');
    } catch (err) {
      console.error('Failed to refresh dashboard data:', err);
      window.app.setConnectionStatus('disconnected');
    }
  }

  async pollLatestReading() {
    const reading = await window.api.getLatestReading(this.selectedPlantId);
    const plant = await window.api.getPlant(this.selectedPlantId);
    const alerts = await window.api.getAlerts({ plantId: this.selectedPlantId, status: 'Active' });

    this.renderMetricCards(plant, reading);
    this.renderActiveAlerts(alerts);
    this.checkFreshness(reading.timestamp);
  }

  // Stale Data Warning Detection
  checkFreshness(timestamp) {
    const timeEl = document.getElementById('last-sensor-time');
    const staleEl = document.getElementById('stale-data-badge');
    if (!timestamp) return;

    const readDate = new Date(timestamp);
    const now = new Date();
    const diffSec = Math.round((now - readDate) / 1000);

    if (timeEl) {
      timeEl.textContent = diffSec < 5 ? 'Just now' : `${diffSec}s ago`;
    }

    const timeoutLimit = window.api.settings.freshnessTimeout || 30;
    if (staleEl) {
      if (diffSec > timeoutLimit) {
        staleEl.style.display = 'inline-flex';
        staleEl.title = `Sensor data is older than ${timeoutLimit}s. ESP32 may be offline.`;
      } else {
        staleEl.style.display = 'none';
      }
    }
  }

  // Render Selected Plant Hero Banner
  renderPlantHero(plant) {
    document.getElementById('hero-plant-name').textContent = plant.name;
    document.getElementById('hero-plant-id').textContent = plant.id;
    document.getElementById('hero-plant-species').textContent = plant.species;
    document.getElementById('hero-plant-stage').textContent = plant.stage;
    document.getElementById('hero-plant-env').textContent = plant.environment;
    document.getElementById('hero-plant-img').src = plant.image || 'assets/images/plant-placeholder.svg';

    const lastWateredText = plant.lastWatered ? this.formatRelativeTime(new Date(plant.lastWatered)) : 'Never';
    document.getElementById('hero-last-watered').textContent = lastWateredText;

    const lastFertilizedText = plant.lastFertilized ? this.formatRelativeTime(new Date(plant.lastFertilized)) : 'None recorded';
    document.getElementById('hero-last-fertilized').textContent = lastFertilizedText;
  }

  // Render 4 Prominent Metric Cards & Health Status Evaluation
  renderMetricCards(plant, reading) {
    const t = plant.thresholds;
    const settings = window.api.settings;

    // 1. Soil Moisture
    const moisture = reading.moisture;
    document.getElementById('val-moisture').textContent = moisture;
    document.getElementById('range-moisture-rec').textContent = `${t.moistureMin}% - ${t.moistureMax}%`;
    
    const moistureBar = document.getElementById('bar-moisture');
    if (moistureBar) moistureBar.style.width = `${Math.min(100, Math.max(0, moisture))}%`;

    let moistureStatus = 'Optimal';
    let moistureBadgeClass = 'badge-optimal';
    if (moisture < t.moistureMin) {
      moistureStatus = 'Low';
      moistureBadgeClass = 'badge-critical';
    } else if (moisture > t.moistureMax) {
      moistureStatus = 'High';
      moistureBadgeClass = 'badge-warning';
    }
    const moistureBadge = document.getElementById('badge-moisture');
    moistureBadge.textContent = moistureStatus;
    moistureBadge.className = `metric-status-badge ${moistureBadgeClass}`;

    // 2. Temperature
    let tempVal = reading.temperature;
    let tempUnit = '°C';
    let tempMin = t.tempMin;
    let tempMax = t.tempMax;

    if (settings.tempUnit === 'F') {
      tempVal = Math.round(((tempVal * 9/5) + 32) * 10) / 10;
      tempMin = Math.round((tempMin * 9/5) + 32);
      tempMax = Math.round((tempMax * 9/5) + 32);
      tempUnit = '°F';
    }
    document.getElementById('val-temp').textContent = tempVal;
    document.getElementById('unit-temp').textContent = tempUnit;
    document.getElementById('range-temp-rec').textContent = `${tempMin}${tempUnit} - ${tempMax}${tempUnit}`;

    let tempStatus = 'Optimal';
    let tempBadgeClass = 'badge-optimal';
    if (reading.temperature < t.tempMin) {
      tempStatus = 'Too Cold';
      tempBadgeClass = 'badge-warning';
    } else if (reading.temperature > t.tempMax) {
      tempStatus = 'Too Hot';
      tempBadgeClass = 'badge-critical';
    }
    const tempBadge = document.getElementById('badge-temp');
    tempBadge.textContent = tempStatus;
    tempBadge.className = `metric-status-badge ${tempBadgeClass}`;

    // 3. Light Intensity (Lux vs Raw ADC)
    const isAdcMode = settings.lightMode === 'adc';
    let lightDisplayVal = reading.lightLux.toLocaleString();
    let lightUnit = 'lux';
    let lightMin = t.lightMinLux.toLocaleString();
    let lightMax = t.lightMaxLux.toLocaleString();

    if (isAdcMode) {
      lightDisplayVal = reading.lightAdc;
      lightUnit = 'ADC (12-bit)';
      lightMin = t.lightMinAdc;
      lightMax = t.lightMaxAdc;
    }

    document.getElementById('val-light').textContent = lightDisplayVal;
    document.getElementById('unit-light').textContent = lightUnit;
    document.getElementById('range-light-rec').textContent = `${lightMin} - ${lightMax} ${lightUnit}`;

    let lightStatus = 'Optimal';
    let lightBadgeClass = 'badge-optimal';
    const currentLightMetric = isAdcMode ? reading.lightAdc : reading.lightLux;
    const minLightMetric = isAdcMode ? t.lightMinAdc : t.lightMinLux;
    const maxLightMetric = isAdcMode ? t.lightMaxAdc : t.lightMaxLux;

    if (currentLightMetric < minLightMetric) {
      lightStatus = 'Too Low';
      lightBadgeClass = 'badge-warning';
    } else if (currentLightMetric > maxLightMetric) {
      lightStatus = 'Too High';
      lightBadgeClass = 'badge-warning';
    }
    const lightBadge = document.getElementById('badge-light');
    lightBadge.textContent = lightStatus;
    lightBadge.className = `metric-status-badge ${lightBadgeClass}`;

    // 4. Overall Plant Health Calculation (Configurable plant-specific thresholds)
    this.calculateOverallHealth(moistureStatus, tempStatus, lightStatus, plant, reading);
  }

  // Multi-factor health evaluation
  calculateOverallHealth(moistureStatus, tempStatus, lightStatus, plant, reading) {
    const healthBadge = document.getElementById('badge-overall-health');
    const healthVal = document.getElementById('val-overall-health');
    const healthDesc = document.getElementById('desc-overall-health');
    const factorsList = document.getElementById('factors-overall-health');

    let health = 'Healthy';
    let badgeClass = 'badge-healthy';
    let explanation = `All environmental sensor readings are within optimal thresholds for ${plant.name}.`;

    const issues = [];
    if (moistureStatus !== 'Optimal') {
      issues.push(`Soil Moisture is ${moistureStatus} (${reading.moisture}%)`);
    }
    if (tempStatus !== 'Optimal') {
      issues.push(`Temperature is ${tempStatus} (${reading.temperature}°C)`);
    }
    if (lightStatus !== 'Optimal') {
      issues.push(`Light is ${lightStatus} (${reading.lightLux.toLocaleString()} lux)`);
    }

    if (issues.length === 0) {
      health = 'Healthy';
      badgeClass = 'badge-healthy';
      explanation = `All physical telemetry readings are currently within ${plant.name}'s recommended physiological zones.`;
    } else if (issues.length === 1 && moistureStatus !== 'Low' && tempStatus !== 'Too Hot') {
      health = 'Needs Attention';
      badgeClass = 'badge-needs-attention';
      explanation = `Moderate deviation detected: ${issues.join(', ')}. Monitoring advised.`;
    } else {
      health = 'Critical';
      badgeClass = 'badge-critical';
      explanation = `Stress alert: ${issues.join('. ')}. Action required to prevent root or leaf damage.`;
    }

    healthVal.textContent = health;
    healthBadge.textContent = health;
    healthBadge.className = `metric-status-badge ${badgeClass}`;
    healthDesc.textContent = explanation;

    // Build contributing factor chips
    factorsList.innerHTML = `
      <span class="factor-chip ${moistureStatus === 'Optimal' ? 'factor-ok' : 'factor-crit'}">
        Soil: ${moistureStatus}
      </span>
      <span class="factor-chip ${tempStatus === 'Optimal' ? 'factor-ok' : 'factor-warn'}">
        Temp: ${tempStatus}
      </span>
      <span class="factor-chip ${lightStatus === 'Optimal' ? 'factor-ok' : 'factor-warn'}">
        Light: ${lightStatus}
      </span>
    `;
  }

  // Render Active Alerts in Dashboard Side Widget
  renderActiveAlerts(alerts) {
    const container = document.getElementById('dashboard-active-alerts');
    const countBadge = document.getElementById('dashboard-active-alerts-count');
    if (!container) return;

    if (countBadge) countBadge.textContent = alerts.length;

    if (alerts.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 2rem 1rem; color: var(--text-muted); font-size: 0.85rem;">
          <div style="font-size: 1.5rem; margin-bottom: 0.5rem; color: var(--primary-500);">✓</div>
          <strong>No Active Alerts</strong>
          <p style="font-size: 0.775rem; margin-top: 0.25rem;">Plant telemetry is in optimal balance.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = alerts.map(alert => `
      <div class="alert-item-mini ${alert.severity.toLowerCase()}">
        <div style="flex: 1;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.2rem;">
            <strong style="color: var(--text-main); font-size: 0.85rem;">${alert.title}</strong>
            <span style="font-size: 0.725rem; color: var(--text-muted);">${this.formatRelativeTime(new Date(alert.timestamp))}</span>
          </div>
          <p style="color: var(--text-muted); font-size: 0.775rem; margin-bottom: 0.4rem;">${alert.message}</p>
          <div style="display: flex; gap: 0.5rem;">
            <button class="btn btn-sm btn-primary" onclick="window.dashboard.quickResolveAlert('${alert.id}', '${alert.type}')" style="font-size: 0.725rem; padding: 0.2rem 0.5rem;">
              Resolve Action
            </button>
            <button class="btn btn-sm btn-secondary" onclick="window.dashboard.acknowledgeAlert('${alert.id}')" style="font-size: 0.725rem; padding: 0.2rem 0.5rem;">
              Ack
            </button>
          </div>
        </div>
      </div>
    `).join('');
  }

  async quickResolveAlert(alertId, alertType) {
    if (alertType === 'Watering') {
      window.app.openWateringModal(this.selectedPlantId, alertId);
    } else {
      await window.api.updateAlert(alertId, {
        status: 'Resolved',
        actionTaken: 'Manually inspected and addressed by operator'
      });
      window.app.showToast('Alert resolved successfully', 'success');
      this.refreshData();
    }
  }

  async acknowledgeAlert(alertId) {
    await window.api.updateAlert(alertId, { acknowledged: true });
    window.app.showToast('Alert acknowledged', 'info');
    this.refreshData();
  }

  // Mini Sparkline preview for 2-hour telemetry trend
  async renderTelemetrySparkline() {
    const canvas = document.getElementById('sparkline-chart');
    if (!canvas || typeof Chart === 'undefined') return;

    try {
      const readings = await window.api.getHistoricalReadings(
        this.selectedPlantId,
        new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
        new Date().toISOString()
      );

      const labels = readings.map(r => new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      const moistureData = readings.map(r => r.moisture);
      const tempData = readings.map(r => r.temperature);

      if (this.sparklineChart) {
        this.sparklineChart.destroy();
      }

      this.sparklineChart = new Chart(canvas, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Soil Moisture (%)',
              data: moistureData,
              borderColor: '#0284c7',
              backgroundColor: 'rgba(2, 132, 199, 0.08)',
              borderWidth: 2,
              fill: true,
              tension: 0.35,
              pointRadius: 2,
              yAxisID: 'y'
            },
            {
              label: 'Temperature (°C)',
              data: tempData,
              borderColor: '#ea580c',
              backgroundColor: 'transparent',
              borderWidth: 2,
              borderDash: [4, 4],
              tension: 0.35,
              pointRadius: 2,
              yAxisID: 'y1'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top',
              labels: { boxWidth: 10, font: { size: 10 } }
            },
            tooltip: {
              mode: 'index',
              intersect: false
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { font: { size: 9 }, maxTicksLimit: 6 }
            },
            y: {
              type: 'linear',
              display: true,
              position: 'left',
              title: { display: true, text: 'Moisture %', font: { size: 9 } },
              grid: { color: '#f1f5f9' },
              ticks: { font: { size: 9 } }
            },
            y1: {
              type: 'linear',
              display: true,
              position: 'right',
              title: { display: true, text: 'Temp °C', font: { size: 9 } },
              grid: { display: false },
              ticks: { font: { size: 9 } }
            }
          }
        }
      });
    } catch (e) {
      console.warn('Sparkline render skipped:', e);
    }
  }

  formatRelativeTime(date) {
    const diff = Math.floor((new Date() - date) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }
}

window.dashboard = new DashboardController();
