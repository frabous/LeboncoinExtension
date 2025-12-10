/**
 * ResellScout - Utilitaires communs
 * Fonctions d'aide pour l'extraction et le calcul
 */

const ResellScoutHelpers = {
  /**
   * Parse un prix depuis une chaîne de caractères
   * @param {string} priceString - La chaîne contenant le prix
   * @returns {number|null} - Le prix en nombre ou null
   */
  parsePrice(priceString) {
    if (!priceString) return null;
    
    // Nettoyer la chaîne
    const cleaned = priceString
      .replace(/[^\d,.\s]/g, '')
      .replace(/\s/g, '')
      .replace(',', '.');
    
    const price = parseFloat(cleaned);
    return isNaN(price) ? null : price;
  },

  /**
   * Formate un prix pour l'affichage
   * @param {number} price - Le prix à formater
   * @returns {string} - Le prix formaté
   */
  formatPrice(price) {
    if (price === null || price === undefined) return 'N/A';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(price);
  },

  /**
   * Calcule le pourcentage de réduction
   * @param {number} originalPrice - Prix original
   * @param {number} currentPrice - Prix actuel
   * @returns {number} - Pourcentage de réduction
   */
  calculateDiscount(originalPrice, currentPrice) {
    if (!originalPrice || !currentPrice) return 0;
    return Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
  },

  /**
   * Calcule le profit potentiel
   * @param {number} marketPrice - Prix du marché
   * @param {number} currentPrice - Prix actuel
   * @returns {number} - Profit potentiel
   */
  calculateProfit(marketPrice, currentPrice) {
    if (!marketPrice || !currentPrice) return 0;
    return marketPrice - currentPrice;
  },

  /**
   * Détermine la note de l'affaire
   * @param {number} marketPrice - Prix du marché
   * @param {number} currentPrice - Prix actuel
   * @returns {Object} - Note et couleur associée
   */
  getDealRating(marketPrice, currentPrice) {
    if (!marketPrice || !currentPrice) {
      return { rating: 'unknown', label: 'Non évalué', color: '#6b7280', emoji: '❓' };
    }

    const discount = this.calculateDiscount(marketPrice, currentPrice);

    if (discount > 40) {
      return { rating: 'excellent', label: 'Excellente Affaire', color: '#10b981', emoji: '🔥' };
    } else if (discount >= 20) {
      return { rating: 'good', label: 'Bonne Affaire', color: '#3b82f6', emoji: '👍' };
    } else if (discount >= 0) {
      return { rating: 'fair', label: 'Prix Correct', color: '#f59e0b', emoji: '➡️' };
    } else {
      return { rating: 'overpriced', label: 'Surévalué', color: '#ef4444', emoji: '⚠️' };
    }
  },

  /**
   * Attend qu'un élément soit présent dans le DOM
   * @param {string} selector - Sélecteur CSS
   * @param {number} timeout - Timeout en ms
   * @returns {Promise<Element>} - L'élément trouvé
   */
  waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver((mutations, obs) => {
        const el = document.querySelector(selector);
        if (el) {
          obs.disconnect();
          resolve(el);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element ${selector} not found within ${timeout}ms`));
      }, timeout);
    });
  },

  /**
   * Attend plusieurs éléments
   * @param {string[]} selectors - Liste de sélecteurs CSS
   * @param {number} timeout - Timeout en ms
   * @returns {Promise<Object>} - Objet avec les éléments trouvés
   */
  async waitForElements(selectors, timeout = 10000) {
    const results = {};
    const promises = selectors.map(async (selector) => {
      try {
        results[selector] = await this.waitForElement(selector, timeout);
      } catch (e) {
        results[selector] = null;
      }
    });
    await Promise.all(promises);
    return results;
  },

  /**
   * Débounce une fonction
   * @param {Function} func - Fonction à débouncer
   * @param {number} wait - Délai en ms
   * @returns {Function} - Fonction débouncée
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  /**
   * Génère un ID unique
   * @returns {string} - ID unique
   */
  generateId() {
    return 'rs_' + Math.random().toString(36).substr(2, 9);
  },

  /**
   * Nettoie une chaîne de caractères
   * @param {string} str - Chaîne à nettoyer
   * @returns {string} - Chaîne nettoyée
   */
  cleanString(str) {
    if (!str) return '';
    return str.trim().replace(/\s+/g, ' ');
  },

  /**
   * Extrait la marque d'un titre
   * @param {string} title - Titre de l'annonce
   * @param {string[]} knownBrands - Liste de marques connues
   * @returns {string|null} - Marque trouvée
   */
  extractBrandFromTitle(title, knownBrands = []) {
    if (!title) return null;
    
    const titleLower = title.toLowerCase();
    for (const brand of knownBrands) {
      if (titleLower.includes(brand.toLowerCase())) {
        return brand;
      }
    }
    return null;
  },

  /**
   * Stockage local avec promesses
   */
  storage: {
    async get(key) {
      return new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => {
          resolve(result[key]);
        });
      });
    },

    async set(key, value) {
      return new Promise((resolve) => {
        chrome.storage.local.set({ [key]: value }, resolve);
      });
    },

    async remove(key) {
      return new Promise((resolve) => {
        chrome.storage.local.remove([key], resolve);
      });
    },

    async getHistory() {
      const history = await this.get('resellscout_history');
      return history || [];
    },

    async addToHistory(item) {
      const history = await this.getHistory();
      history.unshift({
        ...item,
        timestamp: Date.now()
      });
      // Garder seulement les 100 derniers éléments
      if (history.length > 100) {
        history.pop();
      }
      await this.set('resellscout_history', history);
    }
  }
};

// Export pour utilisation globale
window.ResellScoutHelpers = ResellScoutHelpers;
