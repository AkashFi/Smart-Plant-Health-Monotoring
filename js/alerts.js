/**
 * Smart Plant Health Monitoring System - Alerts & Smart Recommendations
 */

class AlertsController {
  constructor() {
    this.alerts = [];
    this.currentFilterSeverity = 'all';
    this.currentFilterStatus = 'all';
    this.currentFilterPlant = 'all';
  }

  async init() {
    this.bindEvents();
    await this.populatePlantFilter();
    await this.loadAlerts();
  }

  bindEvents() {
    // Severity Filter Buttons
    document.querySelectorAll('.alert-filter-severity').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.alert-filter-severity').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.currentFilterSeverity = e.target.dataset.severity;
        this.renderAlerts();
      });
    });

    // Status Filter (Active / Resolved)
    document.querySelectorAll('.alert-filter-status').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.alert-filter-status').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.currentFilterStatus = e.target.dataset.status;
        this.renderAlerts();
      });
    });

    // Plant Filter Dropdown
    const plantFilter = document.getElementById('alerts-plant-filter');
    if (plantFilter) {
      plantFilter.addEventListener('change', (e) => {
        this.currentFilterPlant = e.target.value;
        this.renderAlerts();
      });
    }

    // Report Pest & Disease Observation button
    document.getElementById('btn-report-pest-obs')?.addEventListener('click', () => {
      this.openPestObservationModal();
    });

    // Pest Observation Form submission
    document.getElementById('pest-obs-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handlePestObservationSubmit();
    });

    // Resolve Alert Action Form submission
    document.getElementById('resolve-alert-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleResolveActionSubmit();
    });
  }

  async populatePlantFilter() {
    try {
      const plants = await window.api.getPlants();
      const select = document.getElementById('alerts-plant-filter');
      if (!select) return;

      select.innerHTML = '<option value="all">All Plants</option>';
      plants.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.name} (${p.id})`;
        select.appendChild(opt);
      });
    } catch (e) {
      console.error('Error populating alerts plant filter:', e);
    }
  }

  async loadAlerts() {
    try {
      this.alerts = await window.api.getAlerts();
      this.updateSummaryCounters();
      this.renderAlerts();
    } catch (err) {
      console.error('Failed to load alerts:', err);
    }
  }

  updateSummaryCounters() {
    const totalActive = this.alerts.filter(a => a.status === 'Active');
    const critical = totalActive.filter(a => a.severity === 'Critical').length;
    const warning = totalActive.filter(a => a.severity === 'Warning').length;
    const info = totalActive.filter(a => a.severity === 'Information').length;
    const resolved = this.alerts.filter(a => a.status === 'Resolved').length;

    document.getElementById('counter-alerts-total').textContent = totalActive.length;
    document.getElementById('counter-alerts-critical').textContent = critical;
    document.getElementById('counter-alerts-warning').textContent = warning;
    document.getElementById('counter-alerts-resolved').textContent = resolved;

    // Update sidebar alert badge
    const navBadge = document.getElementById('sidebar-alerts-badge');
    if (navBadge) {
      navBadge.textContent = totalActive.length;
      navBadge.style.display = totalActive.length > 0 ? 'inline-block' : 'none';
    }
  }

  renderAlerts() {
    const container = document.getElementById('alerts-cards-container');
    if (!container) return;

    let filtered = [...this.alerts];

    if (this.currentFilterSeverity !== 'all') {
      filtered = filtered.filter(a => a.severity.toLowerCase() === this.currentFilterSeverity.toLowerCase());
    }
    if (this.currentFilterStatus !== 'all') {
      filtered = filtered.filter(a => a.status.toLowerCase() === this.currentFilterStatus.toLowerCase());
    }
    if (this.currentFilterPlant !== 'all') {
      filtered = filtered.filter(a => a.plantId === this.currentFilterPlant);
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">✅</div>
          <h3>No Alerts Matching Filters</h3>
          <p>All plant parameters are within designated thresholds, or all matching alerts have been resolved.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(alert => {
      const isResolved = alert.status === 'Resolved';
      const severityClass = alert.severity.toLowerCase();

      let icon = '🔔';
      if (alert.type === 'Watering') icon = '💧';
      else if (alert.type === 'Temperature') icon = '🌡️';
      else if (alert.type === 'Light') icon = '☀️';
      else if (alert.type === 'Pest Observation') icon = '🐛';
      else if (alert.type === 'Fertilizer Reminder') icon = '🌱';

      return `
        <div class="alert-card-detailed ${severityClass} ${isResolved ? 'resolved' : ''}">
          <div class="alert-type-icon" style="background: var(--bg-page); font-size: 1.25rem;">
            ${icon}
          </div>

          <div class="alert-content-wrap">
            <div class="alert-meta-top">
              <div class="alert-heading-row">
                <h4>${alert.title}</h4>
                <span class="metric-status-badge badge-${severityClass}">${alert.severity}</span>
                <span class="plant-id-badge">${alert.plantName} (${alert.plantId})</span>
                ${alert.type ? `<span class="chip" style="font-size: 0.7rem;">${alert.type}</span>` : ''}
              </div>
              <span class="alert-time">${new Date(alert.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            </div>

            <p style="font-size: 0.875rem; color: var(--text-main); margin-bottom: 0.5rem;">${alert.message}</p>

            <div class="alert-details-grid">
              <div>
                <strong style="color: var(--text-muted); font-size: 0.75rem; display: block;">READING / TRIGGER:</strong>
                <span style="font-weight: 700; color: var(--text-main);">${alert.sensorValue || 'N/A'}</span>
              </div>
              <div>
                <strong style="color: var(--text-muted); font-size: 0.75rem; display: block;">CONFIGURED THRESHOLD:</strong>
                <span>${alert.threshold || 'N/A'}</span>
              </div>
            </div>

            ${alert.actionRecommended ? `
              <div class="alert-rec-box">
                <strong>💡 Horticultural Recommendation:</strong>
                ${alert.actionRecommended}
              </div>
            ` : ''}

            ${isResolved ? `
              <div style="font-size: 0.8rem; color: var(--primary-700); background: var(--primary-50); padding: 0.5rem 0.75rem; border-radius: var(--radius-sm); margin-bottom: 0.5rem;">
                ✓ <strong>Resolved Action:</strong> ${alert.actionTaken || 'Marked as completed.'}
              </div>
            ` : ''}

            <div class="alert-actions-bar">
              ${!isResolved ? `
                <div style="display: flex; gap: 0.5rem;">
                  <button class="btn btn-sm btn-primary" onclick="window.alerts.openResolveModal('${alert.id}')">
                    Record Action Taken & Resolve
                  </button>
                  ${!alert.acknowledged ? `
                    <button class="btn btn-sm btn-secondary" onclick="window.alerts.acknowledgeAlert('${alert.id}')">
                      Acknowledge
                    </button>
                  ` : `
                    <span class="chip" style="font-size: 0.75rem; color: var(--primary-700);">✓ Acknowledged</span>
                  `}
                </div>
              ` : `
                <span class="chip" style="background: var(--primary-50); color: var(--primary-700); font-weight: 600;">
                  Status: Resolved
                </span>
              `}

              <button class="btn btn-sm btn-secondary" onclick="window.plants.selectForMonitoring('${alert.plantId}')">
                View Live Telemetry →
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  async acknowledgeAlert(alertId) {
    try {
      await window.api.updateAlert(alertId, { acknowledged: true });
      window.app.showToast('Alert acknowledged', 'info');
      await this.loadAlerts();
    } catch (err) {
      window.app.showToast(err.message, 'error');
    }
  }

  openResolveModal(alertId) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert) return;

    document.getElementById('resolve-alert-id').value = alertId;
    document.getElementById('resolve-alert-title').textContent = alert.title;
    document.getElementById('resolve-action-input').value = alert.actionRecommended ? `Completed recommended care: ${alert.actionRecommended.slice(0, 80)}...` : '';
    window.app.openModal('resolve-alert-modal');
  }

  async handleResolveActionSubmit() {
    const alertId = document.getElementById('resolve-alert-id').value;
    const actionTaken = document.getElementById('resolve-action-input').value.trim();
    const alert = this.alerts.find(a => a.id === alertId);

    if (!actionTaken) {
      window.app.showToast('Please specify the action taken', 'error');
      return;
    }

    try {
      await window.api.updateAlert(alertId, {
        status: 'Resolved',
        actionTaken
      });

      // Also record event in Care History Log
      if (alert) {
        await window.api.createCareEvent(alert.plantId, {
          eventType: alert.type === 'Watering' ? 'Watering' : 'Plant Note',
          actionTaken: `Alert resolved: ${actionTaken}`,
          userNotes: `Triggered by alert: ${alert.title}`
        });
      }

      window.app.closeModal('resolve-alert-modal');
      window.app.showToast('Alert marked as resolved', 'success');
      await this.loadAlerts();
      await window.dashboard.refreshData();
    } catch (err) {
      window.app.showToast(err.message, 'error');
    }
  }

  // User-Reported Pest & Disease Observation Modal Form
  async openPestObservationModal() {
    const plants = await window.api.getPlants();
    const select = document.getElementById('pest-plant-select');
    if (select) {
      select.innerHTML = plants.map(p => `<option value="${p.id}">${p.name} (${p.id})</option>`).join('');
    }
    document.getElementById('pest-obs-form').reset();
    window.app.openModal('pest-obs-modal');
  }

  async handlePestObservationSubmit() {
    const plantId = document.getElementById('pest-plant-select').value;
    const plant = await window.api.getPlant(plantId);
    const symptoms = document.getElementById('pest-symptoms-input').value.trim();
    const affectedParts = document.getElementById('pest-affected-parts').value;
    const severity = document.getElementById('pest-severity-select').value;
    const photoUrl = document.getElementById('pest-photo-url').value.trim();

    if (!symptoms) {
      window.app.showToast('Please describe the observed symptoms', 'error');
      return;
    }

    // Guidance generator: cautious IPM recommendations (no indiscriminate pesticides)
    let guidance = 'Inspect underside of leaves under magnifying glass. Gently wipe with clean damp cloth. Isolate plant to prevent cross-contamination.';
    if (symptoms.toLowerCase().includes('aphid') || symptoms.toLowerCase().includes('mite') || symptoms.toLowerCase().includes('whitefly')) {
      guidance = 'Use mild organic insecticidal soap or diluted cold-pressed neem oil spray in late evening. Avoid spraying under direct harsh sunlight.';
    } else if (symptoms.toLowerCase().includes('fung') || symptoms.toLowerCase().includes('mildew') || symptoms.toLowerCase().includes('spot')) {
      guidance = 'Improve air circulation around foliage. Avoid overhead wetting; water directly at the base of soil. Remove severely affected leaves with sterilized shears.';
    }

    // Save as an alert with clear user-reported observation label
    const newAlert = {
      id: `ALT-${Date.now().toString().slice(-4)}`,
      plantId: plant.id,
      plantName: plant.name,
      severity,
      type: 'Pest Observation',
      title: `User Observation: ${symptoms.slice(0, 35)}...`,
      message: `Observed on ${affectedParts}: "${symptoms}". (Note: Logged from manual user inspection; ESP32 sensors do not detect biological pests).`,
      sensorValue: 'Visual Inspection',
      threshold: 'Zero pest tolerance',
      actionRecommended: guidance,
      actionTaken: null,
      status: 'Active',
      acknowledged: false,
      timestamp: new Date().toISOString()
    };

    const alerts = await window.api.getAlerts();
    alerts.unshift(newAlert);
    localStorage.setItem(window.api.STORAGE_KEY_ALERTS, JSON.stringify(alerts));

    // Also record event in Care History Log
    await window.api.createCareEvent(plant.id, {
      eventType: 'Pest Treatment',
      actionTaken: `Observed symptoms: ${symptoms}`,
      userNotes: `Affected: ${affectedParts}. Guidance provided: ${guidance}`
    });

    window.app.closeModal('pest-obs-modal');
    window.app.showToast('Pest observation recorded and care guidance generated', 'success');
    await this.loadAlerts();
  }
}

window.alerts = new AlertsController();
