/**
 * ResellScout - Sidebar UI Component v2.0
 * Sidebar fixée à droite avec système de favoris
 */

const ResellScoutOverlay = {
  containerId: 'resellscout-sidebar-container',
  shadowRoot: null,
  isCollapsed: false,
  currentSources: { used: [] },
  currentTab: 'analysis',
  currentQuery: '',
  currentAnalysis: null,
  favorites: [],
  sidebarWidth: 320,

  /**
   * Initialise la sidebar
   */
  async init() {
    this.remove();
    
    // Charger les favoris
    await this.loadFavorites();
    
    // Créer le conteneur principal
    const container = document.createElement('div');
    container.id = this.containerId;
    container.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      height: 100vh;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    `;
    
    // Créer le Shadow DOM
    this.shadowRoot = container.attachShadow({ mode: 'closed' });
    
    // Injecter les styles
    this.injectStyles();
    
    // Créer le HTML
    this.shadowRoot.innerHTML += this.getSidebarHTML();
    
    // Ajouter au DOM
    document.body.appendChild(container);
    
    // Configurer les événements
    this.setupEventListeners();
    
    // Pousser le contenu de la page vers la gauche
    this.adjustPageLayout(true);
    
    console.log('[ResellScout] Sidebar initialisée');
  },

  /**
   * Ajuste le layout de la page pour faire de la place à la sidebar
   */
  adjustPageLayout(show) {
    const collapsedWidth = 40;
    let width = 0;
    
    if (show) {
      width = this.isCollapsed ? collapsedWidth : this.sidebarWidth;
    }
    
    // Ajuster le body
    document.body.style.marginRight = `${width}px`;
    document.body.style.transition = 'margin-right 0.3s ease';
    document.body.style.overflowX = 'hidden';
    
    // Ajuster le html
    document.documentElement.style.marginRight = `${width}px`;
    document.documentElement.style.transition = 'margin-right 0.3s ease';
    document.documentElement.style.overflowX = 'hidden';
    
    // Ajuster les éléments fixed (header, etc.)
    const fixedSelectors = [
      'header',
      '[class*="header"]',
      '[class*="Header"]',
      '[class*="navbar"]',
      '[class*="Navbar"]',
      '[class*="top-bar"]',
      '[class*="topbar"]',
      '[class*="sticky"]'
    ];
    
    fixedSelectors.forEach(selector => {
      try {
        document.querySelectorAll(selector).forEach(el => {
          const style = window.getComputedStyle(el);
          if (style.position === 'fixed' || style.position === 'sticky') {
            el.style.transition = 'right 0.3s ease, width 0.3s ease';
            if (style.right === '0px' || style.right === 'auto') {
              el.style.right = `${width}px`;
            }
            // Si l'élément a width: 100%, ajuster
            if (style.width === '100%' || el.style.width === '100%') {
              el.style.width = `calc(100% - ${width}px)`;
            }
          }
        });
      } catch (e) {
        // Ignorer les erreurs de sélecteur
      }
    });
  },

  /**
   * Injecte les styles CSS
   */
  injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      /* ============================================
         SIDEBAR DESIGN - DARK MODE
         ============================================ */

      .rs-sidebar {
        width: 320px;
        height: 100vh;
        background: #0d0d0d;
        display: flex;
        flex-direction: column;
        transition: width 0.3s ease;
        border-left: 1px solid #1a1a1a;
        font-size: 13px;
        color: #e0e0e0;
        overflow: hidden;
      }

      .rs-sidebar.collapsed {
        width: 40px;
      }

      .rs-sidebar.collapsed .rs-header,
      .rs-sidebar.collapsed .rs-tabs,
      .rs-sidebar.collapsed .rs-body {
        opacity: 0;
        pointer-events: none;
      }

      /* Toggle Button */
      .rs-toggle-btn {
        position: absolute;
        left: -32px;
        top: 50%;
        transform: translateY(-50%);
        width: 32px;
        height: 64px;
        background: #0d0d0d;
        border: 1px solid #1a1a1a;
        border-right: none;
        border-radius: 8px 0 0 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #666;
        font-size: 14px;
        transition: all 0.2s;
      }

      .rs-toggle-btn:hover {
        background: #1a1a1a;
        color: #10b981;
      }

      /* Header */
      .rs-header {
        background: #0d0d0d;
        padding: 16px;
        border-bottom: 1px solid #1a1a1a;
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-shrink: 0;
      }

      .rs-header-left {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .rs-logo {
        font-size: 20px;
      }

      .rs-title {
        font-weight: 600;
        font-size: 15px;
        color: #fff;
        letter-spacing: 0.3px;
      }

      .rs-header-actions {
        display: flex;
        gap: 4px;
      }

      .rs-btn-icon {
        background: transparent;
        border: none;
        border-radius: 6px;
        width: 28px;
        height: 28px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s;
        color: #555;
        font-size: 14px;
      }

      .rs-btn-icon:hover {
        background: #1a1a1a;
        color: #fff;
      }

      .rs-btn-icon.active {
        color: #10b981;
        background: rgba(16, 185, 129, 0.1);
      }

      /* Tabs */
      .rs-tabs {
        display: flex;
        border-bottom: 1px solid #1a1a1a;
        background: #0d0d0d;
        flex-shrink: 0;
      }

      .rs-tab {
        flex: 1;
        padding: 12px;
        text-align: center;
        border: none;
        background: transparent;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
        color: #555;
        transition: all 0.15s;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }

      .rs-tab.active {
        color: #10b981;
        border-bottom: 2px solid #10b981;
        background: rgba(16, 185, 129, 0.05);
      }

      .rs-tab:hover:not(.active) {
        color: #888;
        background: #111;
      }

      .rs-tab-badge {
        background: #10b981;
        color: #000;
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 10px;
        font-weight: 600;
      }

      /* Body */
      .rs-body {
        flex: 1;
        overflow-y: auto;
        padding: 0;
      }

      .rs-body::-webkit-scrollbar {
        width: 4px;
      }

      .rs-body::-webkit-scrollbar-track {
        background: transparent;
      }

      .rs-body::-webkit-scrollbar-thumb {
        background: #333;
        border-radius: 2px;
      }

      /* Panel Analyse */
      .rs-panel {
        display: none;
        padding: 16px;
      }

      .rs-panel.active {
        display: block;
      }

      /* Search Section */
      .rs-search-section {
        background: #111;
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 16px;
      }

      .rs-search-label {
        font-size: 10px;
        color: #555;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .rs-search-input-wrapper {
        display: flex;
        gap: 8px;
      }

      .rs-search-input {
        flex: 1;
        background: #0d0d0d;
        border: 1px solid #222;
        border-radius: 6px;
        padding: 10px 12px;
        color: #e0e0e0;
        font-size: 12px;
        font-family: inherit;
        outline: none;
        transition: border-color 0.15s;
      }

      .rs-search-input:focus {
        border-color: #10b981;
      }

      .rs-search-btn {
        background: #10b981;
        border: none;
        border-radius: 6px;
        padding: 10px 14px;
        color: #000;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s;
      }

      .rs-search-btn:hover {
        background: #059669;
      }

      /* Rating Badge */
      .rs-rating-card {
        background: #111;
        border-radius: 10px;
        padding: 16px;
        margin-bottom: 16px;
        text-align: center;
        border: 1px solid #1a1a1a;
      }

      .rs-rating-emoji {
        font-size: 36px;
        margin-bottom: 8px;
        display: block;
      }

      .rs-rating-label {
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 4px;
      }

      .rs-rating-label.excellent { color: #10b981; }
      .rs-rating-label.good { color: #60a5fa; }
      .rs-rating-label.fair { color: #fbbf24; }
      .rs-rating-label.overpriced { color: #f87171; }

      .rs-rating-subtitle {
        font-size: 11px;
        color: #555;
      }

      /* Price Grid */
      .rs-price-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-bottom: 16px;
      }

      .rs-price-card {
        background: #111;
        border-radius: 8px;
        padding: 12px;
        text-align: center;
        border: 1px solid #1a1a1a;
      }

      .rs-price-card.full-width {
        grid-column: 1 / -1;
      }

      .rs-price-card-label {
        font-size: 10px;
        color: #555;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 4px;
      }

      .rs-price-card-value {
        font-size: 18px;
        font-weight: 700;
        color: #fff;
      }

      .rs-price-card-value.market {
        color: #10b981;
      }

      .rs-price-card-value.profit {
        color: #10b981;
      }

      .rs-price-card-value.profit.negative {
        color: #f87171;
      }

      .rs-price-card-subtitle {
        font-size: 10px;
        color: #555;
        margin-top: 2px;
      }

      /* Info List */
      .rs-info-list {
        background: #111;
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 16px;
        border: 1px solid #1a1a1a;
      }

      .rs-info-row {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid #1a1a1a;
        font-size: 12px;
      }

      .rs-info-row:last-child {
        border-bottom: none;
      }

      .rs-info-label {
        color: #555;
      }

      .rs-info-value {
        color: #e0e0e0;
        font-weight: 500;
      }

      /* Action Buttons */
      .rs-actions {
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
      }

      .rs-btn {
        flex: 1;
        background: #1a1a1a;
        color: #e0e0e0;
        border: 1px solid #222;
        border-radius: 8px;
        padding: 10px 12px;
        font-size: 11px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }

      .rs-btn:hover {
        background: #222;
        border-color: #333;
        color: #fff;
      }

      .rs-btn-primary {
        background: #10b981;
        color: #000;
        border-color: #10b981;
      }

      .rs-btn-primary:hover {
        background: #059669;
        border-color: #059669;
      }

      .rs-btn-favorite {
        background: transparent;
        border: 1px solid #333;
      }

      .rs-btn-favorite.saved {
        background: rgba(251, 191, 36, 0.1);
        border-color: #fbbf24;
        color: #fbbf24;
      }

      /* Sources Section */
      .rs-sources-section {
        background: #111;
        border-radius: 8px;
        border: 1px solid #1a1a1a;
        overflow: hidden;
      }

      .rs-sources-header {
        padding: 12px;
        border-bottom: 1px solid #1a1a1a;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .rs-sources-title {
        font-size: 11px;
        font-weight: 600;
        color: #888;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .rs-sources-count {
        font-size: 10px;
        background: #222;
        padding: 2px 8px;
        border-radius: 10px;
        color: #888;
      }

      .rs-sources-list {
        max-height: 250px;
        overflow-y: auto;
      }

      .rs-source-item {
        display: flex;
        gap: 10px;
        padding: 10px 12px;
        border-bottom: 1px solid #1a1a1a;
        cursor: pointer;
        transition: background 0.15s;
        text-decoration: none;
        color: inherit;
      }

      .rs-source-item:last-child {
        border-bottom: none;
      }

      .rs-source-item:hover {
        background: #1a1a1a;
      }

      .rs-source-image {
        width: 44px;
        height: 44px;
        border-radius: 6px;
        object-fit: cover;
        background: #222;
        flex-shrink: 0;
      }

      .rs-source-image.placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
      }

      .rs-source-info {
        flex: 1;
        min-width: 0;
      }

      .rs-source-name {
        font-size: 12px;
        font-weight: 500;
        color: #e0e0e0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-bottom: 4px;
      }

      .rs-source-details {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 11px;
      }

      .rs-source-price {
        font-weight: 600;
        color: #10b981;
      }

      .rs-source-platform {
        background: #222;
        padding: 2px 6px;
        border-radius: 4px;
        color: #888;
        font-size: 9px;
        text-transform: uppercase;
      }

      .rs-source-score {
        font-weight: 600;
        font-size: 10px;
      }

      /* Favorites Panel */
      .rs-favorites-empty {
        text-align: center;
        padding: 40px 20px;
        color: #555;
      }

      .rs-favorites-empty-icon {
        font-size: 48px;
        margin-bottom: 12px;
        opacity: 0.5;
      }

      .rs-favorites-empty-text {
        font-size: 13px;
        margin-bottom: 4px;
      }

      .rs-favorites-empty-hint {
        font-size: 11px;
        color: #444;
      }

      .rs-favorite-item {
        background: #111;
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 10px;
        border: 1px solid #1a1a1a;
        cursor: pointer;
        transition: all 0.15s;
      }

      .rs-favorite-item:hover {
        border-color: #333;
        background: #151515;
      }

      .rs-favorite-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 8px;
      }

      .rs-favorite-title {
        font-size: 12px;
        font-weight: 500;
        color: #e0e0e0;
        flex: 1;
        margin-right: 8px;
        line-height: 1.3;
      }

      .rs-favorite-actions {
        display: flex;
        gap: 4px;
      }

      .rs-favorite-btn {
        background: transparent;
        border: none;
        color: #555;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        font-size: 12px;
        transition: all 0.15s;
      }

      .rs-favorite-btn:hover {
        background: #222;
        color: #fff;
      }

      .rs-favorite-btn.delete:hover {
        color: #f87171;
      }

      .rs-favorite-prices {
        display: flex;
        gap: 12px;
        margin-bottom: 8px;
      }

      .rs-favorite-price {
        font-size: 11px;
      }

      .rs-favorite-price-label {
        color: #555;
        margin-right: 4px;
      }

      .rs-favorite-price-value {
        font-weight: 600;
        color: #e0e0e0;
      }

      .rs-favorite-price-value.market {
        color: #10b981;
      }

      .rs-favorite-meta {
        display: flex;
        justify-content: space-between;
        font-size: 10px;
        color: #444;
      }

      .rs-favorite-platform {
        background: #222;
        padding: 2px 6px;
        border-radius: 4px;
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }

      .rs-favorite-rating {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      /* Loading State */
      .rs-loading {
        text-align: center;
        padding: 40px 20px;
      }

      .rs-spinner {
        width: 32px;
        height: 32px;
        border: 2px solid #222;
        border-top-color: #10b981;
        border-radius: 50%;
        animation: rs-spin 0.8s linear infinite;
        margin: 0 auto 12px;
      }

      @keyframes rs-spin {
        to { transform: rotate(360deg); }
      }

      .rs-loading-text {
        color: #555;
        font-size: 12px;
      }

      /* Error State */
      .rs-error {
        text-align: center;
        padding: 30px 20px;
        color: #f87171;
      }

      .rs-error-icon {
        font-size: 32px;
        margin-bottom: 8px;
      }

      .rs-error-text {
        font-size: 12px;
      }

      /* Confidence Indicator */
      .rs-confidence-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        display: inline-block;
        margin-right: 4px;
      }

      .rs-confidence-dot.high { background: #10b981; }
      .rs-confidence-dot.medium { background: #fbbf24; }
      .rs-confidence-dot.low { background: #f87171; }

      /* Notification Toast */
      .rs-toast {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #222;
        color: #fff;
        padding: 10px 16px;
        border-radius: 8px;
        font-size: 12px;
        display: flex;
        align-items: center;
        gap: 8px;
        animation: rs-toast-in 0.3s ease;
        z-index: 1000;
      }

      @keyframes rs-toast-in {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      }
    `;
    this.shadowRoot.appendChild(style);
  },

  /**
   * Génère le HTML de la sidebar
   */
  getSidebarHTML() {
    return `
      <div class="rs-sidebar" id="rs-sidebar">
        <button class="rs-toggle-btn" id="rs-toggle-btn" title="Réduire/Agrandir">
          ◀
        </button>

        <div class="rs-header">
          <div class="rs-header-left">
            <span class="rs-logo">📊</span>
            <span class="rs-title">ResellScout</span>
          </div>
          <div class="rs-header-actions">
            <button class="rs-btn-icon" id="rs-btn-refresh" title="Actualiser">
              ↻
            </button>
          </div>
        </div>

        <div class="rs-tabs">
          <button class="rs-tab active" data-tab="analysis">
            📈 Analyse
          </button>
          <button class="rs-tab" data-tab="favorites">
            ⭐ Favoris
            <span class="rs-tab-badge" id="rs-favorites-count" style="display: none;">0</span>
          </button>
        </div>

        <div class="rs-body">
          <!-- Panel Analyse -->
          <div class="rs-panel active" id="rs-panel-analysis">
            <div class="rs-loading" id="rs-loading">
              <div class="rs-spinner"></div>
              <div class="rs-loading-text">Analyse en cours...</div>
            </div>

            <div id="rs-content" style="display: none;">
              <!-- Search -->
              <div class="rs-search-section">
                <div class="rs-search-label">🔍 Requête de recherche</div>
                <div class="rs-search-input-wrapper">
                  <input type="text" class="rs-search-input" id="rs-search-input" placeholder="Modifier la recherche...">
                  <button class="rs-search-btn" id="rs-search-btn">OK</button>
                </div>
              </div>

              <!-- Rating -->
              <div class="rs-rating-card" id="rs-rating-card">
                <span class="rs-rating-emoji" id="rs-rating-emoji">⏳</span>
                <div class="rs-rating-label" id="rs-rating-label">Analyse...</div>
                <div class="rs-rating-subtitle" id="rs-rating-subtitle">Chargement des données</div>
              </div>

              <!-- Prices -->
              <div class="rs-price-grid">
                <div class="rs-price-card">
                  <div class="rs-price-card-label">Prix affiché</div>
                  <div class="rs-price-card-value" id="rs-current-price">-</div>
                </div>
                <div class="rs-price-card">
                  <div class="rs-price-card-label">Marché occasion</div>
                  <div class="rs-price-card-value market" id="rs-market-price">-</div>
                </div>
                <div class="rs-price-card full-width">
                  <div class="rs-price-card-label">Économie potentielle</div>
                  <div class="rs-price-card-value profit" id="rs-profit-value">-</div>
                  <div class="rs-price-card-subtitle" id="rs-profit-percent">-</div>
                </div>
              </div>

              <!-- Actions -->
              <div class="rs-actions">
                <button class="rs-btn rs-btn-favorite" id="rs-btn-favorite">
                  ☆ Favoris
                </button>
                <button class="rs-btn" id="rs-btn-sources">
                  📦 Sources
                </button>
              </div>

              <!-- Info -->
              <div class="rs-info-list">
                <div class="rs-info-row">
                  <span class="rs-info-label">Sources</span>
                  <span class="rs-info-value" id="rs-info-sources">-</span>
                </div>
                <div class="rs-info-row">
                  <span class="rs-info-label">Annonces analysées</span>
                  <span class="rs-info-value" id="rs-info-count">-</span>
                </div>
                <div class="rs-info-row">
                  <span class="rs-info-label">Fourchette</span>
                  <span class="rs-info-value" id="rs-info-range">-</span>
                </div>
                <div class="rs-info-row">
                  <span class="rs-info-label">Confiance</span>
                  <span class="rs-info-value" id="rs-info-confidence">-</span>
                </div>
              </div>

              <!-- Sources -->
              <div class="rs-sources-section" id="rs-sources-section" style="display: none;">
                <div class="rs-sources-header">
                  <span class="rs-sources-title">Annonces similaires</span>
                  <span class="rs-sources-count" id="rs-sources-count">0</span>
                </div>
                <div class="rs-sources-list" id="rs-sources-list">
                </div>
              </div>
            </div>

            <div class="rs-error" id="rs-error" style="display: none;">
              <div class="rs-error-icon">⚠️</div>
              <div class="rs-error-text" id="rs-error-text">Erreur d'analyse</div>
            </div>
          </div>

          <!-- Panel Favoris -->
          <div class="rs-panel" id="rs-panel-favorites">
            <div id="rs-favorites-list">
              <div class="rs-favorites-empty">
                <div class="rs-favorites-empty-icon">⭐</div>
                <div class="rs-favorites-empty-text">Aucun favori</div>
                <div class="rs-favorites-empty-hint">Ajoutez des articles pour les retrouver ici</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Configure les événements
   */
  setupEventListeners() {
    // Toggle sidebar
    const toggleBtn = this.shadowRoot.getElementById('rs-toggle-btn');
    const sidebar = this.shadowRoot.getElementById('rs-sidebar');
    
    toggleBtn.addEventListener('click', () => {
      this.isCollapsed = !this.isCollapsed;
      sidebar.classList.toggle('collapsed', this.isCollapsed);
      toggleBtn.textContent = this.isCollapsed ? '▶' : '◀';
      // Ajuster le layout de la page
      this.adjustPageLayout(true);
    });

    // Refresh
    const btnRefresh = this.shadowRoot.getElementById('rs-btn-refresh');
    btnRefresh.addEventListener('click', () => {
      if (window.ResellScoutMain) {
        window.ResellScoutMain.analyze();
      }
    });

    // Tabs
    const tabs = this.shadowRoot.querySelectorAll('.rs-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        const tabName = tab.dataset.tab;
        this.shadowRoot.querySelectorAll('.rs-panel').forEach(p => p.classList.remove('active'));
        this.shadowRoot.getElementById(`rs-panel-${tabName}`).classList.add('active');
        
        if (tabName === 'favorites') {
          this.renderFavorites();
        }
      });
    });

    // Search
    const searchInput = this.shadowRoot.getElementById('rs-search-input');
    const searchBtn = this.shadowRoot.getElementById('rs-search-btn');
    
    searchBtn.addEventListener('click', () => this.performCustomSearch());
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.performCustomSearch();
    });

    // Favorite button
    const btnFavorite = this.shadowRoot.getElementById('rs-btn-favorite');
    btnFavorite.addEventListener('click', () => this.toggleFavorite());

    // Sources toggle
    const btnSources = this.shadowRoot.getElementById('rs-btn-sources');
    const sourcesSection = this.shadowRoot.getElementById('rs-sources-section');
    
    btnSources.addEventListener('click', () => {
      const isVisible = sourcesSection.style.display !== 'none';
      sourcesSection.style.display = isVisible ? 'none' : 'block';
      btnSources.textContent = isVisible ? '📦 Sources' : '📦 Masquer';
    });
  },

  /**
   * Recherche personnalisée
   */
  performCustomSearch() {
    const searchInput = this.shadowRoot.getElementById('rs-search-input');
    const query = searchInput.value.trim();
    
    if (!query) return;
    
    this.currentQuery = query;
    
    if (window.ResellScoutMain) {
      window.ResellScoutMain.analyzeWithQuery(query);
    }
  },

  /**
   * Affiche l'état de chargement
   */
  showLoading() {
    if (!this.shadowRoot) return;
    
    const loading = this.shadowRoot.getElementById('rs-loading');
    const content = this.shadowRoot.getElementById('rs-content');
    const error = this.shadowRoot.getElementById('rs-error');

    if (loading) loading.style.display = 'block';
    if (content) content.style.display = 'none';
    if (error) error.style.display = 'none';
  },

  /**
   * Affiche une erreur
   */
  showError(message) {
    if (!this.shadowRoot) return;
    
    const loading = this.shadowRoot.getElementById('rs-loading');
    const content = this.shadowRoot.getElementById('rs-content');
    const error = this.shadowRoot.getElementById('rs-error');
    const errorText = this.shadowRoot.getElementById('rs-error-text');

    if (loading) loading.style.display = 'none';
    if (content) content.style.display = 'none';
    if (error) error.style.display = 'block';
    if (errorText) errorText.textContent = message;
  },

  /**
   * Affiche les résultats
   */
  showResults(analysis) {
    if (!this.shadowRoot) return;
    
    const loading = this.shadowRoot.getElementById('rs-loading');
    const content = this.shadowRoot.getElementById('rs-content');
    const error = this.shadowRoot.getElementById('rs-error');

    if (loading) loading.style.display = 'none';
    if (content) content.style.display = 'block';
    if (error) error.style.display = 'none';

    this.currentAnalysis = analysis;

    // Search query
    if (analysis.searchQuery) {
      this.currentQuery = analysis.searchQuery;
      this.shadowRoot.getElementById('rs-search-input').value = analysis.searchQuery;
    }

    // Rating
    const ratingEmoji = this.shadowRoot.getElementById('rs-rating-emoji');
    const ratingLabel = this.shadowRoot.getElementById('rs-rating-label');
    const ratingSubtitle = this.shadowRoot.getElementById('rs-rating-subtitle');
    
    ratingEmoji.textContent = analysis.emoji || '📊';
    ratingLabel.textContent = analysis.ratingLabel || 'Analyse';
    ratingLabel.className = `rs-rating-label ${analysis.rating || ''}`;
    ratingSubtitle.textContent = analysis.recommendation || '';

    // Prices
    this.shadowRoot.getElementById('rs-current-price').textContent = this.formatPrice(analysis.currentPrice);
    this.shadowRoot.getElementById('rs-market-price').textContent = 
      analysis.averageUsedPrice ? this.formatPrice(analysis.averageUsedPrice) : 'N/A';

    // Profit
    const profitEl = this.shadowRoot.getElementById('rs-profit-value');
    const profitPercentEl = this.shadowRoot.getElementById('rs-profit-percent');
    const isNegative = analysis.profit < 0;
    
    profitEl.textContent = (isNegative ? '' : '+') + this.formatPrice(analysis.profit);
    profitEl.classList.toggle('negative', isNegative);
    profitPercentEl.textContent = `${isNegative ? '' : '+'}${(analysis.discount || 0).toFixed(1)}% vs marché`;

    // Info
    const sourcesText = analysis.sourcesUsed?.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' + ') || '-';
    this.shadowRoot.getElementById('rs-info-sources').textContent = sourcesText;
    this.shadowRoot.getElementById('rs-info-count').textContent = 
      analysis.dataPoints > 0 ? `${analysis.dataPoints} annonces` : '-';
    
    if (analysis.priceRange?.min && analysis.priceRange?.max) {
      this.shadowRoot.getElementById('rs-info-range').textContent = 
        `${this.formatPrice(analysis.priceRange.min)} - ${this.formatPrice(analysis.priceRange.max)}`;
    } else {
      this.shadowRoot.getElementById('rs-info-range').textContent = '-';
    }

    // Confidence
    const confMap = { high: 'Élevée', medium: 'Moyenne', low: 'Faible' };
    const confEl = this.shadowRoot.getElementById('rs-info-confidence');
    confEl.innerHTML = `<span class="rs-confidence-dot ${analysis.confidence || 'low'}"></span>${confMap[analysis.confidence] || 'N/A'}`;

    // Sources
    this.currentSources.used = analysis.usedSources || [];
    this.renderSources();

    // Update favorite button
    this.updateFavoriteButton();
  },

  /**
   * Rend la liste des sources
   */
  renderSources() {
    const sourcesList = this.shadowRoot.getElementById('rs-sources-list');
    const sourcesCount = this.shadowRoot.getElementById('rs-sources-count');
    const sources = this.currentSources.used;

    sourcesCount.textContent = sources.length;

    if (sources.length === 0) {
      sourcesList.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #555; font-size: 12px;">
          Aucune annonce similaire trouvée
        </div>
      `;
      return;
    }

    sourcesList.innerHTML = sources.map(source => {
      const title = source.title || 'Article';
      const price = source.price || 0;
      const image = source.image || source.photo || source.thumbnail || null;
      const platform = source.platform || source.source || 'inconnu';
      const score = source.relevanceScore || 0;
      
      let scoreColor = '#ef4444';
      if (score >= 80) scoreColor = '#10b981';
      else if (score >= 60) scoreColor = '#3b82f6';
      else if (score >= 40) scoreColor = '#f59e0b';

      const imageHTML = image 
        ? `<img src="${image}" alt="" class="rs-source-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'"><div class="rs-source-image placeholder" style="display:none">📦</div>`
        : `<div class="rs-source-image placeholder">📦</div>`;

      return `
        <a href="${source.url || source.link || '#'}" class="rs-source-item" target="_blank" rel="noopener">
          ${imageHTML}
          <div class="rs-source-info">
            <div class="rs-source-name" title="${title}">${title}</div>
            <div class="rs-source-details">
              <span class="rs-source-price">${this.formatPrice(price)}</span>
              <span class="rs-source-platform">${platform}</span>
              ${score > 0 ? `<span class="rs-source-score" style="color: ${scoreColor}">${score}%</span>` : ''}
            </div>
          </div>
        </a>
      `;
    }).join('');
  },

  /**
   * Charge les favoris depuis le storage
   */
  async loadFavorites() {
    try {
      const result = await chrome.storage.local.get(['resellscout_favorites']);
      this.favorites = result.resellscout_favorites || [];
      this.updateFavoritesCount();
    } catch (e) {
      console.warn('[ResellScout] Erreur chargement favoris:', e);
      this.favorites = [];
    }
  },

  /**
   * Sauvegarde les favoris
   */
  async saveFavorites() {
    try {
      await chrome.storage.local.set({ resellscout_favorites: this.favorites });
      this.updateFavoritesCount();
    } catch (e) {
      console.warn('[ResellScout] Erreur sauvegarde favoris:', e);
    }
  },

  /**
   * Met à jour le compteur de favoris
   */
  updateFavoritesCount() {
    const badge = this.shadowRoot?.getElementById('rs-favorites-count');
    if (badge) {
      badge.textContent = this.favorites.length;
      badge.style.display = this.favorites.length > 0 ? 'inline' : 'none';
    }
  },

  /**
   * Vérifie si l'article actuel est en favori
   */
  isCurrentFavorite() {
    const url = window.location.href;
    return this.favorites.some(f => f.url === url);
  },

  /**
   * Met à jour le bouton favoris
   */
  updateFavoriteButton() {
    const btn = this.shadowRoot?.getElementById('rs-btn-favorite');
    if (!btn) return;
    
    const isFav = this.isCurrentFavorite();
    btn.classList.toggle('saved', isFav);
    btn.innerHTML = isFav ? '★ Favori' : '☆ Favoris';
  },

  /**
   * Toggle favori pour l'article actuel
   */
  async toggleFavorite() {
    const url = window.location.href;
    const existingIndex = this.favorites.findIndex(f => f.url === url);

    if (existingIndex >= 0) {
      // Retirer des favoris
      this.favorites.splice(existingIndex, 1);
      this.showToast('Retiré des favoris');
    } else {
      // Ajouter aux favoris
      if (!this.currentAnalysis) return;

      const favorite = {
        id: Date.now(),
        url: url,
        title: this.currentQuery || document.title.split('|')[0].trim(),
        currentPrice: this.currentAnalysis.currentPrice,
        marketPrice: this.currentAnalysis.averageUsedPrice,
        profit: this.currentAnalysis.profit,
        rating: this.currentAnalysis.rating,
        emoji: this.currentAnalysis.emoji,
        platform: window.location.hostname.includes('vinted') ? 'vinted' : 'leboncoin',
        dateAdded: new Date().toISOString()
      };

      this.favorites.unshift(favorite);
      this.showToast('Ajouté aux favoris ⭐');
    }

    await this.saveFavorites();
    this.updateFavoriteButton();
  },

  /**
   * Rend la liste des favoris
   */
  renderFavorites() {
    const container = this.shadowRoot.getElementById('rs-favorites-list');

    if (this.favorites.length === 0) {
      container.innerHTML = `
        <div class="rs-favorites-empty">
          <div class="rs-favorites-empty-icon">⭐</div>
          <div class="rs-favorites-empty-text">Aucun favori</div>
          <div class="rs-favorites-empty-hint">Ajoutez des articles pour les retrouver ici</div>
        </div>
      `;
      return;
    }

    container.innerHTML = this.favorites.map(fav => {
      const profitClass = (fav.profit || 0) < 0 ? 'negative' : '';
      const profitSign = (fav.profit || 0) >= 0 ? '+' : '';
      const dateStr = new Date(fav.dateAdded).toLocaleDateString('fr-FR');

      return `
        <div class="rs-favorite-item" data-id="${fav.id}">
          <div class="rs-favorite-header">
            <div class="rs-favorite-title">${fav.title}</div>
            <div class="rs-favorite-actions">
              <button class="rs-favorite-btn open" title="Ouvrir">↗</button>
              <button class="rs-favorite-btn delete" title="Supprimer">×</button>
            </div>
          </div>
          <div class="rs-favorite-prices">
            <div class="rs-favorite-price">
              <span class="rs-favorite-price-label">Prix:</span>
              <span class="rs-favorite-price-value">${this.formatPrice(fav.currentPrice)}</span>
            </div>
            <div class="rs-favorite-price">
              <span class="rs-favorite-price-label">Marché:</span>
              <span class="rs-favorite-price-value market">${fav.marketPrice ? this.formatPrice(fav.marketPrice) : 'N/A'}</span>
            </div>
          </div>
          <div class="rs-favorite-meta">
            <span class="rs-favorite-platform">${fav.platform}</span>
            <span class="rs-favorite-rating">${fav.emoji || '📊'} ${profitSign}${this.formatPrice(fav.profit || 0)}</span>
            <span>${dateStr}</span>
          </div>
        </div>
      `;
    }).join('');

    // Event listeners pour les favoris
    container.querySelectorAll('.rs-favorite-item').forEach(item => {
      const id = parseInt(item.dataset.id);
      const fav = this.favorites.find(f => f.id === id);
      
      item.querySelector('.open').addEventListener('click', (e) => {
        e.stopPropagation();
        if (fav) window.open(fav.url, '_blank');
      });

      item.querySelector('.delete').addEventListener('click', async (e) => {
        e.stopPropagation();
        this.favorites = this.favorites.filter(f => f.id !== id);
        await this.saveFavorites();
        this.renderFavorites();
        this.updateFavoriteButton();
        this.showToast('Favori supprimé');
      });

      item.addEventListener('click', () => {
        if (fav) window.open(fav.url, '_blank');
      });
    });
  },

  /**
   * Affiche un toast
   */
  showToast(message) {
    // Supprimer les toasts existants
    this.shadowRoot.querySelectorAll('.rs-toast').forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = 'rs-toast';
    toast.textContent = message;
    this.shadowRoot.appendChild(toast);

    setTimeout(() => toast.remove(), 2500);
  },

  /**
   * Formate un prix
   */
  formatPrice(price) {
    if (price === null || price === undefined) return 'N/A';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(price);
  },

  /**
   * Supprime la sidebar
   */
  remove() {
    // Restaurer le layout de la page
    this.adjustPageLayout(false);
    
    const container = document.getElementById(this.containerId);
    if (container) container.remove();
    this.shadowRoot = null;
  },

  /**
   * Vérifie si la sidebar existe
   */
  exists() {
    return document.getElementById(this.containerId) !== null;
  },

  // Méthodes de compatibilité avec l'ancien code
  setSearchQuery(query) {
    this.currentQuery = query;
    const input = this.shadowRoot?.getElementById('rs-search-input');
    if (input) input.value = query;
  }
};

// Export global
window.ResellScoutOverlay = ResellScoutOverlay;
