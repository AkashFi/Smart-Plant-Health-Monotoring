/**
 * Smart Plant Health Monitoring System - Main Application Orchestrator
 */

class AppController {
  constructor() {
    this.currentPage = 'dashboard';
  }

  async init() {
    this.setupClock();
    this.setupRouting();
    this.setupMobileMenu();
    this.setupModalDismissers();
    this.setupCareActionForms();
    this.updateDemoModeUI();

    // Initialize Sub-controllers
    await window.dashboard.init();
    await window.plants.init();
    await window.charts.init();
    await window.alerts.init();
    await window.historyLog.init();
    await window.settings.init();

    // Listen to hash changes
    window.addEventListener('hashchange', () => this.handleHashChange());
    this.handleHashChange();
  }

  // Live Digital Clock
  setupClock() {
    const timeEl = document.getElementById('live-clock');
    const dateEl = document.getElementById('live-date');

    const update = () => {
      const now = new Date();
      if (timeEl) {
        timeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
      if (dateEl) {
        dateEl.textContent = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      }
    };

    update();
    setInterval(update, 1000);
  }

  // Hash-based SPA Navigation
  setupRouting() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        // Close mobile drawer if open
        this.closeMobileSidebar();
      });
    });
  }

  handleHashChange() {
    const rawHash = window.location.hash.replace('#', '') || 'dashboard';
    const validPages = ['dashboard', 'plants', 'history-charts', 'alerts', 'care-log', 'settings'];
    const targetPage = validPages.includes(rawHash) ? rawHash : 'dashboard';

    this.currentPage = targetPage;

    // Toggle pages
    document.querySelectorAll('.page').forEach(page => {
      page.classList.remove('active');
    });
    const activePage = document.getElementById(`page-${targetPage}`);
    if (activePage) activePage.classList.add('active');

    // Toggle sidebar active links
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === `#${targetPage}`) {
        link.classList.add('active');
      }
    });

    // Refresh subcomponents on navigation
    if (targetPage === 'dashboard') {
      window.dashboard.refreshData();
      window.dashboard.startPolling();
    } else {
      window.dashboard.stopPolling();
    }

    if (targetPage === 'plants') window.plants.loadPlants();
    if (targetPage === 'history-charts') window.charts.loadChartData();
    if (targetPage === 'alerts') window.alerts.loadAlerts();
    if (targetPage === 'care-log') window.historyLog.loadHistory();
    if (targetPage === 'settings') window.settings.loadCurrentSettingsIntoForm();

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Mobile drawer
  setupMobileMenu() {
    const toggleBtn = document.getElementById('btn-mobile-menu');
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');

    toggleBtn?.addEventListener('click', () => {
      sidebar?.classList.toggle('open');
      backdrop?.classList.toggle('active');
    });

    backdrop?.addEventListener('click', () => {
      this.closeMobileSidebar();
    });
  }

  closeMobileSidebar() {
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebar-backdrop')?.classList.remove('active');
  }

  // Connection Indicator State (3 states: connected, disconnected, connecting)
  setConnectionStatus(state) {
    const pill = document.getElementById('esp32-status-pill');
    const sidebarPill = document.getElementById('sidebar-esp-status');
    const label = document.getElementById('esp32-status-text');

    if (!pill || !label) return;

    pill.className = `connection-pill ${state}`;
    if (sidebarPill) sidebarPill.className = `connection-pill ${state}`;

    if (state === 'connected') {
      label.textContent = 'ESP32 Online';
    } else if (state === 'connecting') {
      label.textContent = 'Syncing...';
    } else {
      label.textContent = 'ESP32 Offline';
    }
  }

  // Demo Mode Banner & Indicator
  updateDemoModeUI() {
    const isDemo = window.api.isDemoMode();
    const banner = document.getElementById('demo-mode-banner');
    const demoBadge = document.getElementById('topbar-demo-badge');

    if (banner) banner.style.display = isDemo ? 'flex' : 'none';
    if (demoBadge) {
      demoBadge.textContent = isDemo ? 'Demo Mode' : 'Live API Mode';
      demoBadge.className = isDemo ? 'chip highlight' : 'chip';
    }
  }

  // Toast Notification System
  showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✓';
    else if (type === 'error') icon = '✕';
    else if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `
      <span style="font-weight: 700;">${icon}</span>
      <span style="flex: 1;">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 250);
    }, duration);
  }

  // Generic Modal Control
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  setupModalDismissers() {
    // Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(modal => {
          this.closeModal(modal.id);
        });
      }
    });

    // Close buttons & overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          this.closeModal(overlay.id);
        }
      });

      overlay.querySelectorAll('.modal-close-btn, [data-modal-dismiss]').forEach(btn => {
        btn.addEventListener('click', () => {
          this.closeModal(overlay.id);
        });
      });
    });
  }

  // ===================================================================
  // Care Action Modals (Watering, Fertilizer, Pest Treatment, Note)
  // ===================================================================

  async populatePlantOptionsForModal(selectId, defaultPlantId) {
    const select = document.getElementById(selectId);
    if (!select) return;

    const plants = await window.api.getPlants();
    select.innerHTML = plants.map(p => `
      <option value="${p.id}" ${p.id === defaultPlantId ? 'selected' : ''}>
        ${p.name} (${p.id})
      </option>
    `).join('');
  }

  async openWateringModal(plantId = null, alertId = null) {
    const targetPlantId = plantId || window.dashboard.selectedPlantId;
    await this.populatePlantOptionsForModal('water-plant-select', targetPlantId);

    const now = new Date();
    document.getElementById('water-datetime-input').value = now.toISOString().slice(0, 16);
    document.getElementById('water-amount-input').value = '350';
    document.getElementById('water-notes-input').value = 'Soil drench until slight pot runoff.';
    document.getElementById('water-resolve-alert-id').value = alertId || '';

    this.openModal('watering-modal');
  }

  async openFertilizerModal(plantId = null) {
    const targetPlantId = plantId || window.dashboard.selectedPlantId;
    await this.populatePlantOptionsForModal('fert-plant-select', targetPlantId);

    const now = new Date();
    document.getElementById('fert-datetime-input').value = now.toISOString().slice(0, 16);
    document.getElementById('fert-product-input').value = 'Organic Balanced NPK 5-5-5';
    document.getElementById('fert-amount-input').value = '10 ml diluted in 1L water';
    document.getElementById('fert-notes-input').value = 'Foliar & root feed.';

    this.openModal('fertilizer-modal');
  }

  async openPestModal(plantId = null) {
    const targetPlantId = plantId || window.dashboard.selectedPlantId;
    await this.populatePlantOptionsForModal('pest-treat-plant-select', targetPlantId);

    const now = new Date();
    document.getElementById('pest-treat-datetime-input').value = now.toISOString().slice(0, 16);
    document.getElementById('pest-treat-method-input').value = 'Neem Oil Spray (0.5% solution)';
    document.getElementById('pest-treat-symptoms-input').value = 'Minor aphid presence under lower leaves.';
    document.getElementById('pest-treat-notes-input').value = 'Applied in evening to prevent leaf scorch.';

    this.openModal('pest-treatment-modal');
  }

  async openNoteModal(plantId = null) {
    const targetPlantId = plantId || window.dashboard.selectedPlantId;
    await this.populatePlantOptionsForModal('note-plant-select', targetPlantId);

    const now = new Date();
    document.getElementById('note-datetime-input').value = now.toISOString().slice(0, 16);
    document.getElementById('note-category-select').value = 'General Observation';
    document.getElementById('note-text-input').value = '';

    this.openModal('note-modal');
  }

  setupCareActionForms() {
    // 1. Watering Form
    document.getElementById('watering-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const plantId = document.getElementById('water-plant-select').value;
      const timestamp = document.getElementById('water-datetime-input').value;
      const amount = document.getElementById('water-amount-input').value;
      const source = document.getElementById('water-source-input').value;
      const notes = document.getElementById('water-notes-input').value;
      const alertId = document.getElementById('water-resolve-alert-id').value;

      try {
        await window.api.createCareEvent(plantId, {
          eventType: 'Watering',
          timestamp: new Date(timestamp).toISOString(),
          actionTaken: `Watered ${amount}ml (${source})`,
          userNotes: notes,
          waterAmount: `${amount}ml`
        });

        // Resolve active watering alert if linked
        if (alertId) {
          await window.api.updateAlert(alertId, {
            status: 'Resolved',
            actionTaken: `Completed watering with ${amount}ml (${source})`
          });
        }

        this.closeModal('watering-modal');
        this.showToast('Watering recorded successfully. Moisture levels refreshed.', 'success');
        await window.dashboard.refreshData();
        await window.historyLog.loadHistory();
      } catch (err) {
        this.showToast(err.message, 'error');
      }
    });

    // 2. Fertilizer Form
    document.getElementById('fertilizer-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const plantId = document.getElementById('fert-plant-select').value;
      const timestamp = document.getElementById('fert-datetime-input').value;
      const product = document.getElementById('fert-product-input').value;
      const amount = document.getElementById('fert-amount-input').value;
      const method = document.getElementById('fert-method-input').value;
      const notes = document.getElementById('fert-notes-input').value;

      try {
        await window.api.createCareEvent(plantId, {
          eventType: 'Fertilizer',
          timestamp: new Date(timestamp).toISOString(),
          actionTaken: `Applied ${product} (${amount}) via ${method}`,
          userNotes: notes,
          fertilizerProduct: product
        });

        this.closeModal('fertilizer-modal');
        this.showToast('Fertilizer application recorded.', 'success');
        await window.dashboard.refreshData();
        await window.historyLog.loadHistory();
      } catch (err) {
        this.showToast(err.message, 'error');
      }
    });

    // 3. Pest Treatment Form
    document.getElementById('pest-treatment-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const plantId = document.getElementById('pest-treat-plant-select').value;
      const timestamp = document.getElementById('pest-treat-datetime-input').value;
      const method = document.getElementById('pest-treat-method-input').value;
      const symptoms = document.getElementById('pest-treat-symptoms-input').value;
      const notes = document.getElementById('pest-treat-notes-input').value;

      try {
        await window.api.createCareEvent(plantId, {
          eventType: 'Pest Treatment',
          timestamp: new Date(timestamp).toISOString(),
          actionTaken: `Applied: ${method}`,
          userNotes: `Observed symptoms: ${symptoms}. Notes: ${notes}`,
          treatmentDetails: method
        });

        this.closeModal('pest-treatment-modal');
        this.showToast('Pest treatment recorded.', 'success');
        await window.historyLog.loadHistory();
      } catch (err) {
        this.showToast(err.message, 'error');
      }
    });

    // 4. Plant Note Form
    document.getElementById('note-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const plantId = document.getElementById('note-plant-select').value;
      const timestamp = document.getElementById('note-datetime-input').value;
      const category = document.getElementById('note-category-select').value;
      const text = document.getElementById('note-text-input').value.trim();

      if (!text) {
        this.showToast('Please enter a note', 'error');
        return;
      }

      try {
        await window.api.createCareEvent(plantId, {
          eventType: 'Plant Note',
          timestamp: new Date(timestamp).toISOString(),
          actionTaken: `Note [${category}]`,
          userNotes: text
        });

        this.closeModal('note-modal');
        this.showToast('Plant note saved.', 'success');
        await window.historyLog.loadHistory();
      } catch (err) {
        this.showToast(err.message, 'error');
      }
    });
  }
}

// Instantiate and initialize when DOM is ready
window.app = new AppController();
document.addEventListener('DOMContentLoaded', () => {
  window.app.init();
});
