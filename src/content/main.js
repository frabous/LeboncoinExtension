/**
 * ResellScout - Main Content Script
 * Point d'entrée principal pour l'analyse des pages produit
 */

const ResellScoutMain = {
  currentData: null,
  currentAnalysis: null,
  isInitialized: false,

  /**
   * Initialise l'extension sur la page
   */
  async init() {
    if (this.isInitialized) return;
    
    console.log('[ResellScout] Initialisation...');
    
    // Détecter la plateforme
    const platform = this.detectPlatform();
    if (!platform) {
      console.log('[ResellScout] Plateforme non supportée');
      return;
    }
    
    console.log('[ResellScout] Plateforme détectée:', platform);
    
    // Attendre que la page soit complètement chargée
    await this.waitForPageLoad();
    
    // Initialiser l'overlay
    ResellScoutOverlay.init();
    
    // Lancer l'analyse automatique
    await this.analyze();
    
    // Observer les changements de page (SPA)
    this.setupNavigationObserver();
    
    this.isInitialized = true;
    console.log('[ResellScout] Initialisé avec succès');
  },

  /**
   * Détecte la plateforme actuelle
   * @returns {string|null} - Nom de la plateforme
   */
  detectPlatform() {
    const hostname = window.location.hostname;
    
    if (hostname.includes('vinted.fr')) {
      return 'vinted';
    } else if (hostname.includes('leboncoin.fr')) {
      return 'leboncoin';
    }
    
    return null;
  },

  /**
   * Récupère le scraper approprié pour la plateforme
   * @returns {Object|null} - Scraper
   */
  getScraper() {
    const platform = this.detectPlatform();
    
    if (platform === 'vinted' && window.VintedScraper) {
      return window.VintedScraper;
    } else if (platform === 'leboncoin' && window.LeBonCoinScraper) {
      return window.LeBonCoinScraper;
    }
    
    return null;
  },

  /**
   * Attend que la page soit chargée
   * @returns {Promise<void>}
   */
  waitForPageLoad() {
    return new Promise((resolve) => {
      if (document.readyState === 'complete') {
        // Attendre un peu plus pour les SPAs
        setTimeout(resolve, 1500);
      } else {
        window.addEventListener('load', () => {
          setTimeout(resolve, 1500);
        });
      }
    });
  },

  /**
   * Lance l'analyse de l'article
   */
  async analyze() {
    const scraper = this.getScraper();
    
    if (!scraper) {
      console.error('[ResellScout] Scraper non disponible');
      ResellScoutOverlay.showError('Scraper non disponible pour cette plateforme');
      return;
    }

    // Vérifier qu'on est sur une page produit
    if (!scraper.isProductPage()) {
      console.log('[ResellScout] Pas une page produit');
      ResellScoutOverlay.remove();
      return;
    }

    // Afficher le chargement
    ResellScoutOverlay.showLoading();

    try {
      // Extraire les données de la page
      console.log('[ResellScout] Extraction des données...');
      const itemData = await scraper.extractAll();
      this.currentData = itemData;

      console.log('[ResellScout] Données extraites:', itemData);

      // Vérifier les données - être plus tolérant
      if (!itemData.title && itemData.price === null) {
        // Essayer de ré-extraire après un délai
        console.log('[ResellScout] Données insuffisantes, nouvelle tentative...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const retryData = await scraper.extractAll();
        if (!retryData.title && retryData.price === null) {
          throw new Error('Impossible d\'extraire les données de cette page. Rechargez la page et réessayez.');
        }
        Object.assign(itemData, retryData);
      }

      // Créer des données minimales si nécessaire
      if (!itemData.title) {
        // Essayer d'extraire depuis le titre de la page
        const pageTitle = document.title.split('|')[0].split('-')[0].trim();
        if (pageTitle && pageTitle.length > 2) {
          itemData.title = pageTitle;
        }
      }

      if (itemData.price === null) {
        // Chercher un prix sur la page
        const priceMatch = document.body.innerText.match(/(\d{1,5}[,.]\d{2})\s*€/);
        if (priceMatch) {
          itemData.price = parseFloat(priceMatch[1].replace(',', '.'));
        }
      }

      // Envoyer au background script pour l'analyse
      console.log('[ResellScout] Envoi au service worker...');
      
      const response = await this.sendMessage({
        action: 'analyzeItem',
        itemData: itemData
      });

      if (response && response.success) {
        this.currentAnalysis = response.analysis;
        console.log('[ResellScout] Analyse reçue:', response.analysis);
        ResellScoutOverlay.showResults(response.analysis);
      } else {
        throw new Error(response?.error || 'Erreur de communication avec le service worker');
      }

    } catch (error) {
      console.error('[ResellScout] Erreur d\'analyse:', error);
      
      // Afficher un message d'erreur plus informatif
      let errorMessage = error.message || 'Impossible d\'analyser cet article';
      if (errorMessage.includes('message port closed')) {
        errorMessage = 'Erreur de connexion. Rechargez l\'extension.';
      }
      
      ResellScoutOverlay.showError(errorMessage);
    }
  },

  /**
   * Lance une analyse avec une requête personnalisée
   * @param {string} customQuery - Requête de recherche personnalisée
   */
  async analyzeWithQuery(customQuery) {
    const scraper = this.getScraper();
    
    if (!scraper) {
      console.error('[ResellScout] Scraper non disponible');
      ResellScoutOverlay.showError('Scraper non disponible');
      return;
    }

    // Afficher le chargement
    ResellScoutOverlay.showLoading();

    try {
      // Utiliser les données existantes ou les extraire
      let itemData = this.currentData;
      
      if (!itemData) {
        itemData = await scraper.extractAll();
      }
      
      // Remplacer le titre par la requête personnalisée
      const customItemData = {
        ...itemData,
        title: customQuery,
        customQuery: customQuery // Marquer que c'est une requête personnalisée
      };

      console.log('[ResellScout] Recherche personnalisée:', customQuery);
      
      const response = await this.sendMessage({
        action: 'analyzeItem',
        itemData: customItemData
      });

      if (response && response.success) {
        this.currentAnalysis = response.analysis;
        console.log('[ResellScout] Analyse reçue:', response.analysis);
        ResellScoutOverlay.showResults(response.analysis);
      } else {
        throw new Error(response?.error || 'Erreur de communication');
      }

    } catch (error) {
      console.error('[ResellScout] Erreur recherche personnalisée:', error);
      ResellScoutOverlay.showError(error.message || 'Erreur de recherche');
    }
  },

  /**
   * Envoie un message au background script avec retry
   * @param {Object} message - Message à envoyer
   * @param {number} retries - Nombre de tentatives
   * @returns {Promise<Object>} - Réponse
   */
  async sendMessage(message, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await new Promise((resolve, reject) => {
          // D'abord, réveiller le service worker avec un ping
          chrome.runtime.sendMessage({ action: 'ping' }, () => {
            // Ignorer les erreurs de ping, envoyer le vrai message
            chrome.runtime.sendMessage(message, (response) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve(response);
              }
            });
          });
        });
        return response;
      } catch (error) {
        console.warn(`[ResellScout] Tentative ${attempt}/${retries} échouée:`, error.message);
        if (attempt === retries) {
          throw error;
        }
        // Attendre avant de réessayer
        await new Promise(r => setTimeout(r, 500 * attempt));
      }
    }
  },

  /**
   * Configure l'observateur de navigation pour les SPAs
   */
  setupNavigationObserver() {
    // Observer les changements d'URL
    let lastUrl = window.location.href;
    
    const urlObserver = new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        console.log('[ResellScout] Changement d\'URL détecté:', lastUrl);
        
        // Réinitialiser après un délai pour laisser la page se charger
        setTimeout(() => {
          this.isInitialized = false;
          this.init();
        }, 2000);
      }
    });

    urlObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Écouter aussi l'événement popstate pour la navigation
    window.addEventListener('popstate', () => {
      console.log('[ResellScout] Navigation popstate détectée');
      setTimeout(() => {
        this.isInitialized = false;
        this.init();
      }, 2000);
    });
  },

  /**
   * Affiche une notification toast
   * @param {string} message - Message
   * @param {string} type - Type (success, error, info)
   */
  showToast(message, type = 'info') {
    // Supprimer les toasts existants
    document.querySelectorAll('.resellscout-toast').forEach(el => el.remove());
    
    const toast = document.createElement('div');
    toast.className = `resellscout-toast ${type}`;
    toast.innerHTML = `
      <span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
      <span>${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    // Supprimer après 3 secondes
    setTimeout(() => {
      toast.style.animation = 'resellscout-toast-in 0.3s ease-out reverse';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  /**
   * Récupère l'historique
   * @returns {Promise<Array>}
   */
  async getHistory() {
    const response = await this.sendMessage({ action: 'getHistory' });
    return response.history || [];
  },

  /**
   * Efface l'historique
   * @returns {Promise<boolean>}
   */
  async clearHistory() {
    const response = await this.sendMessage({ action: 'clearHistory' });
    return response.success;
  }
};

// Export global
window.ResellScoutMain = ResellScoutMain;

// Initialiser l'extension
(function() {
  // Attendre que tous les scripts soient chargés
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => ResellScoutMain.init(), 500);
    });
  } else {
    setTimeout(() => ResellScoutMain.init(), 500);
  }
})();
