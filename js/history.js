/**
 * Smart Plant Health Monitoring System - Plant Care History & Activity Log
 */

class HistoryController {
  constructor() {
    this.historyEvents = [];
    this.currentPage = 1;
    this.pageSize = 10;
    this.filterPlant = 'all';
    this.filterType = 'all';
    this.searchQuery = '';
  }

  async init() {
    this.bindEvents();
    await this.populatePlantFilter();
    await this.loadHistory();
  }

  bindEvents() {
    // Filter Plant
    const plantFilter = document.getElementById('history-log-plant-filter');
    if (plantFilter) {
      plantFilter.addEventListener('change', (e) => {
        this.filterPlant = e.target.value;
        this.currentPage = 1;
        this.renderTable();
      });
    }

    // Filter Type
    const typeFilter = document.getElementById('history-log-type-filter');
    if (typeFilter) {
      typeFilter.addEventListener('change', (e) => {
        this.filterType = e.target.value;
        this.currentPage = 1;
        this.renderTable();
      });
    }

    // Search query
    const searchInput = document.getElementById('history-log-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.currentPage = 1;
        this.renderTable();
      });
    }

    // Pagination buttons
    document.getElementById('btn-prev-page')?.addEventListener('click', () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.renderTable();
      }
    });

    document.getElementById('btn-next-page')?.addEventListener('click', () => {
      const maxPages = Math.ceil(this.getFilteredEvents().length / this.pageSize);
      if (this.currentPage < maxPages) {
        this.currentPage++;
        this.renderTable();
      }
    });

    // Quick Care Event Log trigger
    document.getElementById('btn-open-log-event')?.addEventListener('click', () => {
      window.app.openWateringModal();
    });
  }

  async populatePlantFilter() {
    try {
      const plants = await window.api.getPlants();
      const select = document.getElementById('history-log-plant-filter');
      if (!select) return;

      select.innerHTML = '<option value="all">All Plants</option>';
      plants.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.name} (${p.id})`;
        select.appendChild(opt);
      });
    } catch (e) {
      console.error('Error populating history log plant filter:', e);
    }
  }

  async loadHistory() {
    try {
      this.historyEvents = await window.api.getHistory();
      this.renderTable();
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  }

  getFilteredEvents() {
    return this.historyEvents.filter(item => {
      const matchesPlant = this.filterPlant === 'all' || item.plantId === this.filterPlant;
      const matchesType = this.filterType === 'all' || (item.eventType && item.eventType.toLowerCase() === this.filterType.toLowerCase());
      const matchesSearch = !this.searchQuery || 
        (item.plantName && item.plantName.toLowerCase().includes(this.searchQuery)) ||
        (item.actionTaken && item.actionTaken.toLowerCase().includes(this.searchQuery)) ||
        (item.userNotes && item.userNotes.toLowerCase().includes(this.searchQuery));

      return matchesPlant && matchesType && matchesSearch;
    });
  }

  renderTable() {
    const tbody = document.getElementById('history-table-body');
    const paginationInfo = document.getElementById('pagination-info');
    const prevBtn = document.getElementById('btn-prev-page');
    const nextBtn = document.getElementById('btn-next-page');
    if (!tbody) return;

    const filtered = this.getFilteredEvents();
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / this.pageSize));

    if (this.currentPage > totalPages) this.currentPage = totalPages;

    const start = (this.currentPage - 1) * this.pageSize;
    const end = Math.min(start + this.pageSize, total);
    const pageItems = filtered.slice(start, end);

    if (paginationInfo) {
      paginationInfo.textContent = total === 0 ? 'No entries' : `Showing ${start + 1}-${end} of ${total} events`;
    }

    if (prevBtn) prevBtn.disabled = this.currentPage <= 1;
    if (nextBtn) nextBtn.disabled = this.currentPage >= totalPages;

    // Render Page Number Buttons
    const pagesContainer = document.getElementById('pagination-page-numbers');
    if (pagesContainer) {
      pagesContainer.innerHTML = '';
      for (let p = 1; p <= totalPages; p++) {
        const btn = document.createElement('button');
        btn.className = `page-num-btn ${p === this.currentPage ? 'active' : ''}`;
        btn.textContent = p;
        btn.onclick = () => {
          this.currentPage = p;
          this.renderTable();
        };
        pagesContainer.appendChild(btn);
      }
    }

    if (pageItems.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
            No care activities or log records found matching your query.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = pageItems.map(item => {
      let badgeStyle = 'badge-event-note';
      if (item.eventType === 'Watering') badgeStyle = 'badge-event-water';
      else if (item.eventType === 'Fertilizer') badgeStyle = 'badge-event-fertilizer';
      else if (item.eventType === 'Pest Treatment') badgeStyle = 'badge-event-pest';
      else if (item.eventType === 'Sensor Reading') badgeStyle = 'badge-event-reading';
      else if (item.eventType === 'Health Warning') badgeStyle = 'badge-event-warning';

      const healthBadge = item.healthStatus === 'Critical' ? 'badge-critical' : (item.healthStatus === 'Needs Attention' ? 'badge-needs-attention' : 'badge-healthy');

      const dateObj = new Date(item.timestamp);
      const formattedDate = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
      const formattedTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      return `
        <tr>
          <td>
            <div style="font-weight: 600; color: var(--text-main);">${formattedDate}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${formattedTime}</div>
          </td>
          <td>
            <strong>${item.plantName || item.plantId}</strong>
            <div style="font-size: 0.725rem; color: var(--text-muted);">${item.plantId}</div>
          </td>
          <td>
            <span class="event-badge ${badgeStyle}">${item.eventType}</span>
          </td>
          <td>
            <span style="font-weight: 600; color: #0284c7;">${item.soilMoisture !== '--' ? `${item.soilMoisture}%` : '--'}</span>
          </td>
          <td>
            <span style="font-weight: 600; color: #ea580c;">${item.temperature !== '--' ? `${item.temperature}°C` : '--'}</span>
          </td>
          <td>
            <span style="font-size: 0.8rem; color: var(--text-muted);">${item.lightReading || '--'}</span>
          </td>
          <td>
            <span class="metric-status-badge ${healthBadge}" style="font-size: 0.7rem;">${item.healthStatus || 'Normal'}</span>
          </td>
          <td>
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;">
              <span style="max-width: 260px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.actionTaken}">
                ${item.actionTaken}
              </span>
              <button class="btn btn-sm btn-secondary" onclick="window.historyLog.viewDetails('${item.id}')" style="font-size: 0.725rem; padding: 0.2rem 0.5rem;">
                Details
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  viewDetails(eventId) {
    const item = this.historyEvents.find(e => e.id === eventId);
    if (!item) return;

    document.getElementById('detail-event-id').textContent = item.id;
    document.getElementById('detail-plant-name').textContent = `${item.plantName} (${item.plantId})`;
    document.getElementById('detail-event-type').textContent = item.eventType;
    document.getElementById('detail-timestamp').textContent = new Date(item.timestamp).toLocaleString();
    document.getElementById('detail-moisture').textContent = item.soilMoisture !== '--' ? `${item.soilMoisture}%` : 'N/A';
    document.getElementById('detail-temp').textContent = item.temperature !== '--' ? `${item.temperature}°C` : 'N/A';
    document.getElementById('detail-light').textContent = item.lightReading || 'N/A';
    document.getElementById('detail-health').textContent = item.healthStatus || 'Healthy';
    document.getElementById('detail-action').textContent = item.actionTaken;
    document.getElementById('detail-notes').textContent = item.userNotes || 'No additional notes provided.';
    document.getElementById('detail-operator').textContent = item.operator || 'System / Akash';

    window.app.openModal('event-detail-modal');
  }
}

window.historyLog = new HistoryController();
