/**
 * ResellScout - Popup Script
 */

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  loadStats();
  loadHistory();
  loadSettings();
  setupEventListeners();
});

/**
 * Initialise les onglets
 */
function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  const contents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Retirer la classe active de tous
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));

      // Ajouter la classe active au tab cliqué
      tab.classList.add('active');
      const tabId = tab.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');
    });
  });
}

/**
 * Charge les statistiques
 */
async function loadStats() {
  try {
    const response = await sendMessage({ action: 'getHistory' });
    const history = response.history || response.data || [];

    // Total analysé
    document.getElementById('total-analyzed').textContent = history.length;

    // Excellentes affaires
    const excellent = history.filter(item => {
      const rating = item.analysis?.rating || item.profitability?.dealRating;
      return rating === 'excellent' || (rating && rating.includes('EXCEPTIONNELLE'));
    }).length;
    document.getElementById('excellent-deals').textContent = excellent;

    // Économies potentielles (somme des profits positifs)
    const totalSavings = history.reduce((sum, item) => {
      const profit = item.analysis?.profit || item.profitability?.vsOccasion?.difference || 0;
      if (profit > 0) {
        return sum + profit;
      }
      return sum;
    }, 0);
    document.getElementById('total-savings').textContent = formatPrice(totalSavings);

  } catch (error) {
    console.error('Erreur chargement stats:', error);
    // Valeurs par défaut
    document.getElementById('total-analyzed').textContent = '0';
    document.getElementById('excellent-deals').textContent = '0';
    document.getElementById('total-savings').textContent = '0 €';
  }
}

/**
 * Charge l'historique
 */
async function loadHistory() {
  const historyList = document.getElementById('history-list');

  try {
    const response = await sendMessage({ action: 'getHistory' });
    const history = response.history || response.data || [];

    if (history.length === 0) {
      historyList.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">📭</span>
          <p>Aucun article analysé pour le moment.</p>
          <p class="empty-hint">Visitez une page produit sur Vinted ou LeBonCoin.</p>
        </div>
      `;
      return;
    }

    historyList.innerHTML = history.map(item => {
      // Extraire les données de façon compatible avec les deux formats
      const title = item.product?.title || item.title || 'Sans titre';
      const price = item.product?.price || item.price;
      const platform = item.product?.platform || item.platform || 'N/A';
      const url = item.product?.url || item.url || '#';
      const timestamp = item.timestamp || item.savedAt;
      
      // Récupérer l'analyse
      const rating = item.analysis?.rating || 
        (item.profitability?.dealScore >= 80 ? 'excellent' : 
         item.profitability?.dealScore >= 65 ? 'good' : 
         item.profitability?.dealScore >= 50 ? 'fair' : 'overpriced');
      const emoji = item.analysis?.emoji || 
        (rating === 'excellent' ? '🔥' : rating === 'good' ? '✅' : rating === 'fair' ? '⚡' : '⚠️');
      const ratingLabel = item.analysis?.ratingLabel || item.profitability?.dealRating || 'N/A';

      return `
        <div class="history-item" data-url="${escapeHtml(url)}">
          <div class="history-item-header">
            <span class="history-item-title" title="${escapeHtml(title)}">
              ${escapeHtml(truncate(title, 30))}
            </span>
            <span class="history-item-badge ${rating}">
              ${emoji} ${truncate(ratingLabel, 15)}
            </span>
          </div>
          <div class="history-item-details">
            <span class="history-item-price">${formatPrice(price)}</span>
            <span class="history-item-platform">${escapeHtml(platform)}</span>
            <span class="history-item-date">${formatDate(timestamp)}</span>
          </div>
        </div>
      `;
    }).join('');

    // Ajouter les événements de clic pour ouvrir les URLs
    historyList.querySelectorAll('.history-item').forEach(item => {
      item.style.cursor = 'pointer';
      item.addEventListener('click', () => {
        const url = item.getAttribute('data-url');
        if (url) {
          chrome.tabs.create({ url });
        }
      });
    });

  } catch (error) {
    console.error('Erreur chargement historique:', error);
    historyList.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">⚠️</span>
        <p>Erreur lors du chargement de l'historique.</p>
      </div>
    `;
  }
}

/**
 * Charge les paramètres
 */
async function loadSettings() {
  try {
    const response = await sendMessage({ action: 'getSettings' });
    const settings = response.settings || {};

    // Appliquer les paramètres aux toggles
    document.getElementById('setting-auto-analyze').checked = settings.autoAnalyze !== false;
    document.getElementById('setting-show-overlay').checked = settings.showOverlay !== false;
    document.getElementById('setting-notifications').checked = settings.notifications === true;
    document.getElementById('setting-dark-mode').checked = settings.darkMode === true;

    // Position du widget
    const position = settings.overlayPosition || 'bottom-right';
    document.querySelectorAll('.position-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-position') === position);
    });

  } catch (error) {
    console.error('Erreur chargement paramètres:', error);
  }
}

/**
 * Configure les écouteurs d'événements
 */
function setupEventListeners() {
  // Bouton effacer l'historique
  document.getElementById('clear-history').addEventListener('click', async () => {
    if (confirm('Voulez-vous vraiment effacer tout l\'historique ?')) {
      try {
        await sendMessage({ action: 'clearHistory' });
        loadHistory();
        loadStats();
      } catch (error) {
        console.error('Erreur effacement historique:', error);
      }
    }
  });

  // Toggles des paramètres
  const settingToggles = [
    { id: 'setting-auto-analyze', key: 'autoAnalyze' },
    { id: 'setting-show-overlay', key: 'showOverlay' },
    { id: 'setting-notifications', key: 'notifications' },
    { id: 'setting-dark-mode', key: 'darkMode' }
  ];

  settingToggles.forEach(({ id, key }) => {
    document.getElementById(id).addEventListener('change', async (e) => {
      await updateSetting(key, e.target.checked);
    });
  });

  // Boutons de position
  document.querySelectorAll('.position-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.position-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      await updateSetting('overlayPosition', btn.getAttribute('data-position'));
    });
  });
}

/**
 * Met à jour un paramètre
 * @param {string} key - Clé du paramètre
 * @param {*} value - Valeur
 */
async function updateSetting(key, value) {
  try {
    const response = await sendMessage({ action: 'getSettings' });
    const settings = response.settings || {};
    settings[key] = value;
    await sendMessage({ action: 'saveSettings', settings });
  } catch (error) {
    console.error('Erreur mise à jour paramètre:', error);
  }
}

/**
 * Envoie un message au background script
 * @param {Object} message - Message
 * @returns {Promise<Object>} - Réponse
 */
function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response || {});
      }
    });
  });
}

/**
 * Formate un prix
 * @param {number} price - Prix
 * @returns {string}
 */
function formatPrice(price) {
  if (price === null || price === undefined) return 'N/A';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR'
  }).format(price);
}

/**
 * Formate une date
 * @param {number} timestamp - Timestamp
 * @returns {string}
 */
function formatDate(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  // Moins d'une heure
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `il y a ${minutes} min`;
  }

  // Moins d'un jour
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `il y a ${hours}h`;
  }

  // Sinon, date formatée
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short'
  });
}

/**
 * Tronque une chaîne
 * @param {string} str - Chaîne
 * @param {number} length - Longueur max
 * @returns {string}
 */
function truncate(str, length) {
  if (!str) return '';
  if (str.length <= length) return str;
  return str.substring(0, length) + '...';
}

/**
 * Échappe le HTML
 * @param {string} str - Chaîne
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
