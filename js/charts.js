/**
 * Smart Plant Health Monitoring System - Interactive Historical Graphs (Chart.js)
 */

class ChartsController {
  constructor() {
    this.selectedPlantId = 'PLANT-001';
    this.currentTimeRange = '24h'; // '1h', '24h', '7d', '30d', 'custom'
    this.customFrom = null;
    this.customTo = null;

    this.chartMoisture = null;
    this.chartTemp = null;
    this.chartLight = null;
  }

  async init() {
    await this.populatePlantSelector();
    this.bindEvents();
    await this.loadChartData();
  }

  bindEvents() {
    // Plant selector in history page
    const plantSelect = document.getElementById('history-plant-select');
    if (plantSelect) {
      plantSelect.addEventListener('change', (e) => {
        this.selectedPlantId = e.target.value;
        this.loadChartData();
      });
    }

    // Time filter buttons
    const timeButtons = document.querySelectorAll('.time-btn');
    timeButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        timeButtons.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.currentTimeRange = e.target.dataset.range;

        const customInputs = document.getElementById('custom-date-container');
        if (this.currentTimeRange === 'custom') {
          if (customInputs) customInputs.classList.add('visible');
        } else {
          if (customInputs) customInputs.classList.remove('visible');
          this.loadChartData();
        }
      });
    });

    // Custom date range apply button
    document.getElementById('btn-apply-custom-range')?.addEventListener('click', () => {
      const fromInput = document.getElementById('custom-date-from').value;
      const toInput = document.getElementById('custom-date-to').value;
      if (!fromInput || !toInput) {
        window.app.showToast('Please select both start and end dates', 'warning');
        return;
      }
      this.customFrom = new Date(fromInput).toISOString();
      this.customTo = new Date(toInput).toISOString();
      this.loadChartData();
    });

    // Refresh chart button
    document.getElementById('btn-refresh-charts')?.addEventListener('click', () => {
      this.loadChartData();
    });

    // Export buttons
    document.getElementById('btn-export-csv')?.addEventListener('click', () => {
      this.exportData('csv');
    });
    document.getElementById('btn-export-json')?.addEventListener('click', () => {
      this.exportData('json');
    });
  }

  async populatePlantSelector() {
    try {
      const plants = await window.api.getPlants();
      const select = document.getElementById('history-plant-select');
      if (!select) return;

      select.innerHTML = '';
      plants.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.name} (${p.id})`;
        if (p.id === this.selectedPlantId) opt.selected = true;
        select.appendChild(opt);
      });
    } catch (err) {
      console.error('Error populating history plant select:', err);
    }
  }

  calculateDateRange() {
    const now = new Date();
    let from = new Date();

    switch (this.currentTimeRange) {
      case '1h':
        from = new Date(now.getTime() - 1 * 3600 * 1000);
        break;
      case '24h':
        from = new Date(now.getTime() - 24 * 3600 * 1000);
        break;
      case '7d':
        from = new Date(now.getTime() - 7 * 86400 * 1000);
        break;
      case '30d':
        from = new Date(now.getTime() - 30 * 86400 * 1000);
        break;
      case 'custom':
        return {
          from: this.customFrom || new Date(now.getTime() - 24 * 3600 * 1000).toISOString(),
          to: this.customTo || now.toISOString()
        };
    }

    return {
      from: from.toISOString(),
      to: now.toISOString()
    };
  }

  showOverlays(state, message = '') {
    const overlays = document.querySelectorAll('.chart-overlay');
    overlays.forEach(overlay => {
      overlay.classList.remove('hidden');
      if (state === 'loading') {
        overlay.innerHTML = `
          <div class="spin-anim" style="font-size: 2rem; color: var(--primary-600);">⟳</div>
          <p style="font-size: 0.85rem; color: var(--text-muted); font-weight: 500;">Loading historical telemetry...</p>
        `;
      } else if (state === 'empty') {
        overlay.innerHTML = `
          <div style="font-size: 2rem; color: var(--text-light);">📊</div>
          <p style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">No telemetry recorded in this time window</p>
          <span style="font-size: 0.75rem; color: var(--text-light);">${message || 'Adjust the date filter or verify ESP32 logging.'}</span>
        `;
      } else if (state === 'error') {
        overlay.innerHTML = `
          <div style="font-size: 2rem; color: var(--danger-500);">⚠️</div>
          <p style="font-size: 0.85rem; color: var(--danger-600); font-weight: 600;">Failed to fetch historical readings</p>
          <span style="font-size: 0.75rem; color: var(--text-muted);">${message || 'Backend API unavailable'}</span>
          <button class="btn btn-sm btn-secondary" onclick="window.charts.loadChartData()" style="margin-top: 0.5rem;">Retry</button>
        `;
      }
    });
  }

  hideOverlays() {
    const overlays = document.querySelectorAll('.chart-overlay');
    overlays.forEach(overlay => overlay.classList.add('hidden'));
  }

  async loadChartData() {
    this.showOverlays('loading');

    try {
      const { from, to } = this.calculateDateRange();
      const readings = await window.api.getHistoricalReadings(this.selectedPlantId, from, to);
      const plant = await window.api.getPlant(this.selectedPlantId);

      this.currentReadings = readings;

      if (!readings || readings.length === 0) {
        this.showOverlays('empty');
        this.clearStats();
        return;
      }

      this.hideOverlays();
      this.updateStatsCards(readings, plant);
      this.renderCharts(readings, plant);
    } catch (err) {
      console.error('Error loading chart data:', err);
      this.showOverlays('error', err.message);
    }
  }

  clearStats() {
    ['cur', 'min', 'max', 'avg'].forEach(prefix => {
      document.getElementById(`stat-moist-${prefix}`) && (document.getElementById(`stat-moist-${prefix}`).textContent = '--');
      document.getElementById(`stat-temp-${prefix}`) && (document.getElementById(`stat-temp-${prefix}`).textContent = '--');
      document.getElementById(`stat-light-${prefix}`) && (document.getElementById(`stat-light-${prefix}`).textContent = '--');
    });
  }

  updateStatsCards(readings, plant) {
    const moistures = readings.map(r => r.moisture);
    const temps = readings.map(r => r.temperature);
    const lights = readings.map(r => window.api.settings.lightMode === 'adc' ? r.lightAdc : r.lightLux);

    const calc = (arr) => {
      const sum = arr.reduce((a, b) => a + b, 0);
      const avg = Math.round((sum / arr.length) * 10) / 10;
      const min = Math.min(...arr);
      const max = Math.max(...arr);
      const cur = arr[arr.length - 1];
      return { cur, min, max, avg };
    };

    const m = calc(moistures);
    const t = calc(temps);
    const l = calc(lights);

    // Moisture Stats
    document.getElementById('stat-moist-cur').textContent = `${m.cur}%`;
    document.getElementById('stat-moist-min').textContent = `${m.min}%`;
    document.getElementById('stat-moist-max').textContent = `${m.max}%`;
    document.getElementById('stat-moist-avg').textContent = `${m.avg}%`;

    // Temperature Stats
    const tempUnit = window.api.settings.tempUnit === 'F' ? '°F' : '°C';
    document.getElementById('stat-temp-cur').textContent = `${t.cur}${tempUnit}`;
    document.getElementById('stat-temp-min').textContent = `${t.min}${tempUnit}`;
    document.getElementById('stat-temp-max').textContent = `${t.max}${tempUnit}`;
    document.getElementById('stat-temp-avg').textContent = `${t.avg}${tempUnit}`;

    // Light Stats
    const lightUnit = window.api.settings.lightMode === 'adc' ? 'ADC' : 'lux';
    document.getElementById('stat-light-cur').textContent = `${l.cur.toLocaleString()} ${lightUnit}`;
    document.getElementById('stat-light-min').textContent = `${l.min.toLocaleString()} ${lightUnit}`;
    document.getElementById('stat-light-max').textContent = `${l.max.toLocaleString()} ${lightUnit}`;
    document.getElementById('stat-light-avg').textContent = `${l.avg.toLocaleString()} ${lightUnit}`;
  }

  renderCharts(readings, plant) {
    if (typeof Chart === 'undefined') {
      console.warn('Chart.js library is not loaded');
      return;
    }

    const timestamps = readings.map(r => {
      const d = new Date(r.timestamp);
      return this.currentTimeRange === '1h' || this.currentTimeRange === '24h'
        ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit' });
    });

    const moistures = readings.map(r => r.moisture);
    const temps = readings.map(r => r.temperature);
    const isAdc = window.api.settings.lightMode === 'adc';
    const lights = readings.map(r => isAdc ? r.lightAdc : r.lightLux);

    const pt = plant.thresholds;

    // 1. Soil Moisture Chart
    this.renderSoilMoistureChart(timestamps, moistures, pt);

    // 2. Temperature Chart
    this.renderTemperatureChart(timestamps, temps, pt);

    // 3. Light Intensity Chart
    this.renderLightChart(timestamps, lights, pt, isAdc);
  }

  renderSoilMoistureChart(labels, data, pt) {
    const ctx = document.getElementById('chart-canvas-moisture');
    if (!ctx) return;

    if (this.chartMoisture) this.chartMoisture.destroy();

    this.chartMoisture = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Soil Moisture (%)',
            data,
            borderColor: '#0284c7',
            backgroundColor: 'rgba(2, 132, 199, 0.12)',
            borderWidth: 2.5,
            fill: true,
            tension: 0.3,
            pointRadius: data.length > 30 ? 1.5 : 3,
            pointHoverRadius: 6,
            pointBackgroundColor: '#0284c7'
          },
          {
            label: 'Optimal Min Threshold',
            data: Array(data.length).fill(pt.moistureMin),
            borderColor: 'rgba(16, 185, 129, 0.7)',
            borderWidth: 1.5,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
          },
          {
            label: 'Optimal Max Threshold',
            data: Array(data.length).fill(pt.moistureMax),
            borderColor: 'rgba(16, 185, 129, 0.7)',
            borderWidth: 1.5,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12 } },
          tooltip: {
            callbacks: {
              label: (context) => `${context.dataset.label}: ${context.parsed.y}%`
            }
          }
        },
        scales: {
          x: { grid: { color: '#f8fafc' }, ticks: { maxTicksLimit: 8 } },
          y: {
            min: 0,
            max: 100,
            title: { display: true, text: 'Soil Moisture Percentage (%)' },
            grid: { color: '#f1f5f9' }
          }
        }
      }
    });
  }

  renderTemperatureChart(labels, data, pt) {
    const ctx = document.getElementById('chart-canvas-temperature');
    if (!ctx) return;

    if (this.chartTemp) this.chartTemp.destroy();

    const unit = window.api.settings.tempUnit === 'F' ? '°F' : '°C';

    this.chartTemp = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: `Temperature (${unit})`,
            data,
            borderColor: '#ea580c',
            backgroundColor: 'rgba(234, 88, 12, 0.1)',
            borderWidth: 2.5,
            fill: true,
            tension: 0.3,
            pointRadius: data.length > 30 ? 1.5 : 3,
            pointHoverRadius: 6,
            pointBackgroundColor: '#ea580c'
          },
          {
            label: 'Optimal Min Threshold',
            data: Array(data.length).fill(pt.tempMin),
            borderColor: 'rgba(16, 185, 129, 0.7)',
            borderWidth: 1.5,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
          },
          {
            label: 'Optimal Max Threshold',
            data: Array(data.length).fill(pt.tempMax),
            borderColor: 'rgba(16, 185, 129, 0.7)',
            borderWidth: 1.5,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12 } },
          tooltip: {
            callbacks: {
              label: (context) => `${context.dataset.label}: ${context.parsed.y}${unit}`
            }
          }
        },
        scales: {
          x: { grid: { color: '#f8fafc' }, ticks: { maxTicksLimit: 8 } },
          y: {
            title: { display: true, text: `Ambient Temperature (${unit})` },
            grid: { color: '#f1f5f9' }
          }
        }
      }
    });
  }

  renderLightChart(labels, data, pt, isAdc) {
    const ctx = document.getElementById('chart-canvas-light');
    if (!ctx) return;

    if (this.chartLight) this.chartLight.destroy();

    const unit = isAdc ? 'ADC (0-4095)' : 'lux';
    const minThresh = isAdc ? pt.lightMinAdc : pt.lightMinLux;
    const maxThresh = isAdc ? pt.lightMaxAdc : pt.lightMaxLux;

    this.chartLight = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: `Light Intensity (${unit})`,
            data,
            borderColor: '#ca8a04',
            backgroundColor: 'rgba(202, 138, 4, 0.1)',
            borderWidth: 2.5,
            fill: true,
            tension: 0.3,
            pointRadius: data.length > 30 ? 1.5 : 3,
            pointHoverRadius: 6,
            pointBackgroundColor: '#ca8a04'
          },
          {
            label: 'Optimal Min Threshold',
            data: Array(data.length).fill(minThresh),
            borderColor: 'rgba(16, 185, 129, 0.7)',
            borderWidth: 1.5,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
          },
          {
            label: 'Optimal Max Threshold',
            data: Array(data.length).fill(maxThresh),
            borderColor: 'rgba(16, 185, 129, 0.7)',
            borderWidth: 1.5,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12 } },
          tooltip: {
            callbacks: {
              label: (context) => `${context.dataset.label}: ${context.parsed.y.toLocaleString()} ${unit}`
            }
          }
        },
        scales: {
          x: { grid: { color: '#f8fafc' }, ticks: { maxTicksLimit: 8 } },
          y: {
            title: { display: true, text: `Illuminance (${unit})` },
            grid: { color: '#f1f5f9' },
            beginAtZero: true
          }
        }
      }
    });
  }

  exportData(format) {
    if (!this.currentReadings || this.currentReadings.length === 0) {
      window.app.showToast('No telemetry data available to export', 'warning');
      return;
    }

    if (format === 'csv') {
      const headers = ['Timestamp', 'PlantId', 'MoisturePct', 'TemperatureC', 'LightLux', 'LightADC'];
      const rows = this.currentReadings.map(r => [
        `"${r.timestamp}"`,
        `"${r.plantId}"`,
        r.moisture,
        r.temperature,
        r.lightLux,
        r.lightAdc
      ]);
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `plant_telemetry_${this.selectedPlantId}_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.app.showToast('Exported telemetry as CSV', 'success');
    } else if (format === 'json') {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(this.currentReadings, null, 2));
      const link = document.createElement('a');
      link.setAttribute('href', dataStr);
      link.setAttribute('download', `plant_telemetry_${this.selectedPlantId}_${Date.now()}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.app.showToast('Exported telemetry as JSON', 'success');
    }
  }
}

window.charts = new ChartsController();
