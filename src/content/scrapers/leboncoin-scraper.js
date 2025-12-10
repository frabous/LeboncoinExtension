/**
 * ResellScout - Scraper LeBonCoin
 * Extraction des données depuis les pages annonces LeBonCoin
 */

const LeBonCoinScraper = {
  platform: 'leboncoin',
  
  /**
   * Sélecteurs CSS pour LeBonCoin (mis à jour régulièrement)
   */
  selectors: {
    // Titre de l'annonce
    title: [
      '[data-qa-id="adview_title"]',
      'h1[data-qa-id="adview_title"]',
      '.styles_AdTitle__G8HrI',
      'h1.text-headline-1',
      'h1'
    ],
    
    // Prix de l'annonce
    price: [
      '[data-qa-id="adview_price"]',
      '.styles_Price__hD1OA',
      'p[data-qa-id="adview_price"] span',
      '.text-headline-2-bold',
      '[data-test-id="ad-price"]'
    ],
    
    // Catégorie
    category: [
      '[data-qa-id="breadcrumb"]',
      '.styles_Breadcrumb__8QGLW a',
      'nav[aria-label="Fil d\'ariane"] a'
    ],
    
    // Localisation
    location: [
      '[data-qa-id="adview_location_informations"]',
      '.styles_Location__Y3D3Z',
      '[data-test-id="ad-location"]',
      '.text-body-1[data-qa-id="adview_location"]'
    ],
    
    // Date de publication
    date: [
      '[data-qa-id="adview_date"]',
      '.styles_Date__tJfAi',
      'time'
    ],
    
    // Ancien prix (baisse de prix)
    oldPrice: [
      '[data-qa-id="adview_price_old"]',
      '[data-qa-id="adview_old_price"]',
      '.styles_OldPrice__K2qbU',
      '.styles_CrossedPrice__VRYzH',
      '[data-test-id="ad-old-price"]',
      '.text-caption-1.line-through',
      's', // Prix barré
      'del', // Prix supprimé
      '.old-price',
      '.crossed-price'
    ],
    
    // Badge baisse de prix
    priceDropBadge: [
      '[data-qa-id="adview_price_drop"]',
      '.styles_PriceDrop__badge',
      '[data-test-id="price-drop-badge"]',
      '.price-drop',
      '.badge-price-drop'
    ],
    
    // Date originale de mise en ligne
    originalDate: [
      '[data-qa-id="adview_original_date"]',
      '[data-qa-id="adview_first_publication_date"]',
      '.styles_OriginalDate__',
      '[data-test-id="ad-original-date"]'
    ],
    
    // Description
    description: [
      '[data-qa-id="adview_description_container"]',
      '.styles_Description__pxfh2',
      '[data-test-id="ad-description"]'
    ],
    
    // Image principale
    image: [
      '[data-qa-id="adview_gallery_container"] img',
      '.styles_GalleryImage__OcWNU',
      '.slick-current img',
      'img[data-qa-id="adview_image"]'
    ],
    
    // Vendeur
    seller: [
      '[data-qa-id="adview_contact_name"]',
      '.styles_SellerName__8XSMZ',
      '[data-test-id="storefront-name"]'
    ],
    
    // Critères/Attributs
    criteria: [
      '[data-qa-id="criteria_item"]',
      '.styles_Criteria__item__dqVGG',
      '.styles_AttributesList__LDuqn li'
    ]
  },

  /**
   * Trouve un élément avec plusieurs sélecteurs possibles
   * @param {string[]} selectors - Liste de sélecteurs à essayer
   * @returns {Element|null} - L'élément trouvé ou null
   */
  findElement(selectors) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element;
    }
    return null;
  },

  /**
   * Extrait le texte d'un élément
   * @param {string[]} selectors - Sélecteurs CSS
   * @returns {string|null} - Texte extrait
   */
  extractText(selectors) {
    const element = this.findElement(selectors);
    if (!element) return null;
    return ResellScoutHelpers.cleanString(element.textContent);
  },

  /**
   * Extrait le titre de l'annonce
   * @returns {string|null}
   */
  extractTitle() {
    return this.extractText(this.selectors.title);
  },

  /**
   * Extrait le prix de l'annonce
   * @returns {number|null}
   */
  extractPrice() {
    const priceElement = this.findElement(this.selectors.price);
    if (!priceElement) return null;
    
    // LeBonCoin peut avoir le prix dans différents formats
    let priceText = priceElement.textContent;
    
    // Chercher le prix dans les spans enfants
    const priceSpan = priceElement.querySelector('span');
    if (priceSpan) {
      priceText = priceSpan.textContent;
    }
    
    return ResellScoutHelpers.parsePrice(priceText);
  },

  /**
   * Extrait la catégorie depuis le fil d'ariane
   * @returns {string|null}
   */
  extractCategory() {
    const breadcrumbs = document.querySelectorAll('[data-qa-id="breadcrumb"] a, nav[aria-label="Fil d\'ariane"] a');
    if (breadcrumbs.length > 0) {
      const categories = Array.from(breadcrumbs).map(el => el.textContent.trim());
      return categories.slice(1).join(' > '); // Exclure "Accueil"
    }
    return null;
  },

  /**
   * Extrait la localisation
   * @returns {string|null}
   */
  extractLocation() {
    return this.extractText(this.selectors.location);
  },

  /**
   * Extrait la date de publication
   * @returns {string|null}
   */
  extractDate() {
    return this.extractText(this.selectors.date);
  },

  /**
   * Extrait l'ancien prix (avant baisse)
   * @returns {number|null}
   */
  extractOldPrice() {
    // Méthode 1: Chercher via les sélecteurs directs
    const oldPriceElement = this.findElement(this.selectors.oldPrice);
    if (oldPriceElement) {
      const priceText = oldPriceElement.textContent;
      const price = ResellScoutHelpers.parsePrice(priceText);
      if (price) return price;
    }
    
    // Méthode 2: Chercher un prix barré près du prix principal
    const priceContainer = this.findElement(this.selectors.price)?.parentElement;
    if (priceContainer) {
      const crossedPrices = priceContainer.querySelectorAll('s, del, .line-through, [style*="text-decoration: line-through"], [style*="text-decoration:line-through"]');
      for (const crossed of crossedPrices) {
        const price = ResellScoutHelpers.parsePrice(crossed.textContent);
        if (price) return price;
      }
    }
    
    // Méthode 3: Chercher dans tout le document les éléments avec prix barré
    const allCrossed = document.querySelectorAll('[data-qa-id*="old_price"], [data-qa-id*="price_old"], s, del');
    for (const element of allCrossed) {
      const text = element.textContent;
      if (text.includes('€')) {
        const price = ResellScoutHelpers.parsePrice(text);
        if (price) return price;
      }
    }
    
    // Méthode 4: Analyser le JSON-LD de la page
    const jsonLd = this.extractJsonLd();
    if (jsonLd && jsonLd.offers && jsonLd.offers.priceHistory) {
      const history = jsonLd.offers.priceHistory;
      if (history.length > 1) {
        return history[0].price; // Premier prix = ancien prix
      }
    }
    
    return null;
  },

  /**
   * Vérifie si l'annonce a une baisse de prix
   * @returns {boolean}
   */
  hasPriceDrop() {
    // Chercher le badge de baisse de prix
    const badge = this.findElement(this.selectors.priceDropBadge);
    if (badge) return true;
    
    // Chercher dans le texte de la page
    const pageText = document.body.innerText.toLowerCase();
    if (pageText.includes('prix en baisse') || pageText.includes('baisse de prix')) {
      return true;
    }
    
    // Vérifier si un ancien prix existe
    return this.extractOldPrice() !== null;
  },

  /**
   * Calcule le pourcentage de baisse de prix
   * @returns {Object|null}
   */
  calculatePriceDrop() {
    const currentPrice = this.extractPrice();
    const oldPrice = this.extractOldPrice();
    
    if (!currentPrice || !oldPrice || oldPrice <= currentPrice) {
      return null;
    }
    
    const dropAmount = oldPrice - currentPrice;
    const dropPercent = Math.round((dropAmount / oldPrice) * 100);
    
    return {
      oldPrice: oldPrice,
      currentPrice: currentPrice,
      dropAmount: dropAmount,
      dropPercent: dropPercent
    };
  },

  /**
   * Extrait la date originale de mise en ligne
   * @returns {Object}
   */
  extractOriginalDate() {
    // Méthode 1: Sélecteur direct
    const originalDateElement = this.findElement(this.selectors.originalDate);
    if (originalDateElement) {
      return {
        text: ResellScoutHelpers.cleanString(originalDateElement.textContent),
        element: originalDateElement
      };
    }
    
    // Méthode 2: Analyser le JSON-LD
    const jsonLd = this.extractJsonLd();
    if (jsonLd) {
      if (jsonLd.datePosted) {
        return {
          text: this.formatDate(jsonLd.datePosted),
          isoDate: jsonLd.datePosted
        };
      }
      if (jsonLd.dateCreated) {
        return {
          text: this.formatDate(jsonLd.dateCreated),
          isoDate: jsonLd.dateCreated
        };
      }
    }
    
    // Méthode 3: Chercher dans les méta-données
    const metaDate = document.querySelector('meta[property="article:published_time"], meta[name="date"]');
    if (metaDate) {
      const dateValue = metaDate.getAttribute('content');
      return {
        text: this.formatDate(dateValue),
        isoDate: dateValue
      };
    }
    
    // Méthode 4: Extraire depuis l'URL (LeBonCoin inclut parfois la date)
    const urlMatch = window.location.href.match(/(\d{4})(\d{2})(\d{2})/);
    if (urlMatch) {
      const isoDate = `${urlMatch[1]}-${urlMatch[2]}-${urlMatch[3]}`;
      return {
        text: this.formatDate(isoDate),
        isoDate: isoDate
      };
    }
    
    return null;
  },

  /**
   * Extrait le JSON-LD de la page
   * @returns {Object|null}
   */
  extractJsonLd() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);
        // Chercher le produit ou l'annonce
        if (data['@type'] === 'Product' || data['@type'] === 'Offer' || data['@type'] === 'ItemPage') {
          return data;
        }
        // Si c'est un tableau
        if (Array.isArray(data)) {
          const item = data.find(d => ['Product', 'Offer', 'ItemPage'].includes(d['@type']));
          if (item) return item;
        }
      } catch (e) {
        // Ignorer les erreurs de parsing
      }
    }
    return null;
  },

  /**
   * Formate une date ISO en format lisible
   * @param {string} isoDate - Date ISO
   * @returns {string}
   */
  formatDate(isoDate) {
    try {
      const date = new Date(isoDate);
      return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch (e) {
      return isoDate;
    }
  },

  /**
   * Calcule l'ancienneté de l'annonce
   * @returns {Object|null}
   */
  calculateListingAge() {
    const originalDate = this.extractOriginalDate();
    if (!originalDate || !originalDate.isoDate) {
      // Essayer avec la date affichée
      const displayDate = this.extractDate();
      if (!displayDate) return null;
      
      // Parser la date française (ex: "15 novembre 2024")
      const parsed = this.parseFrenchDate(displayDate);
      if (!parsed) return null;
      
      return this.calculateAgeFromDate(parsed);
    }
    
    return this.calculateAgeFromDate(new Date(originalDate.isoDate));
  },

  /**
   * Parse une date en français
   * @param {string} dateStr - Date en français
   * @returns {Date|null}
   */
  parseFrenchDate(dateStr) {
    const months = {
      'janvier': 0, 'février': 1, 'mars': 2, 'avril': 3,
      'mai': 4, 'juin': 5, 'juillet': 6, 'août': 7,
      'septembre': 8, 'octobre': 9, 'novembre': 10, 'décembre': 11
    };
    
    // Format: "15 novembre 2024" ou "15/11/2024"
    const match = dateStr.match(/(\d{1,2})\s*(\w+)\s*(\d{4})/);
    if (match) {
      const day = parseInt(match[1]);
      const month = months[match[2].toLowerCase()];
      const year = parseInt(match[3]);
      if (month !== undefined) {
        return new Date(year, month, day);
      }
    }
    
    // Format: "15/11/2024"
    const slashMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (slashMatch) {
      return new Date(slashMatch[3], slashMatch[2] - 1, slashMatch[1]);
    }
    
    // Format: "Aujourd'hui" ou "Hier"
    if (dateStr.toLowerCase().includes('aujourd')) {
      return new Date();
    }
    if (dateStr.toLowerCase().includes('hier')) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday;
    }
    
    return null;
  },

  /**
   * Calcule l'âge depuis une date
   * @param {Date} date - Date de publication
   * @returns {Object}
   */
  calculateAgeFromDate(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    
    let ageText;
    if (diffDays === 0) {
      ageText = "Aujourd'hui";
    } else if (diffDays === 1) {
      ageText = 'Hier';
    } else if (diffDays < 7) {
      ageText = `Il y a ${diffDays} jours`;
    } else if (diffWeeks < 4) {
      ageText = `Il y a ${diffWeeks} semaine${diffWeeks > 1 ? 's' : ''}`;
    } else if (diffMonths < 12) {
      ageText = `Il y a ${diffMonths} mois`;
    } else {
      const years = Math.floor(diffMonths / 12);
      ageText = `Il y a ${years} an${years > 1 ? 's' : ''}`;
    }
    
    return {
      date: date,
      days: diffDays,
      weeks: diffWeeks,
      months: diffMonths,
      text: ageText,
      isOld: diffDays > 30, // Plus de 30 jours = annonce ancienne
      isVeryOld: diffDays > 90 // Plus de 90 jours = très ancienne
    };
  },

  /**
   * Extrait la description
   * @returns {string|null}
   */
  extractDescription() {
    return this.extractText(this.selectors.description);
  },

  /**
   * Extrait l'URL de l'image principale
   * @returns {string|null}
   */
  extractImage() {
    const imgElement = this.findElement(this.selectors.image);
    if (imgElement) {
      return imgElement.src || imgElement.getAttribute('data-src');
    }
    return null;
  },

  /**
   * Extrait les informations du vendeur
   * @returns {string|null}
   */
  extractSeller() {
    return this.extractText(this.selectors.seller);
  },

  /**
   * Extrait les critères/attributs de l'annonce
   * @returns {Object}
   */
  extractCriteria() {
    const criteria = {};
    const criteriaItems = document.querySelectorAll('[data-qa-id="criteria_item"], .styles_AttributesList__LDuqn li');
    
    criteriaItems.forEach(item => {
      const label = item.querySelector('[data-qa-id="criteria_item_label"], .styles_AttributeLabel__EWFPB');
      const value = item.querySelector('[data-qa-id="criteria_item_value"], .styles_AttributeValue__MQk2r');
      
      if (label && value) {
        const key = ResellScoutHelpers.cleanString(label.textContent).toLowerCase();
        criteria[key] = ResellScoutHelpers.cleanString(value.textContent);
      }
    });
    
    return criteria;
  },

  /**
   * Extrait l'état de l'article depuis les critères
   * @returns {string|null}
   */
  extractCondition() {
    const criteria = this.extractCriteria();
    return criteria['état'] || criteria['etat'] || criteria['condition'] || null;
  },

  /**
   * Extrait la marque depuis les critères ou le titre
   * @returns {string|null}
   */
  extractBrand() {
    const criteria = this.extractCriteria();
    let brand = criteria['marque'] || criteria['brand'] || null;
    
    if (!brand) {
      // Essayer d'extraire depuis le titre
      const title = this.extractTitle();
      const knownBrands = [
        'Nike', 'Adidas', 'Puma', 'Reebok', 'New Balance', 
        'Zara', 'H&M', 'Mango', 'Lacoste', 'Ralph Lauren',
        'Apple', 'Samsung', 'Sony', 'LG', 'Philips',
        'Ikea', 'Conforama', 'Maisons du Monde'
      ];
      brand = ResellScoutHelpers.extractBrandFromTitle(title, knownBrands);
    }
    
    return brand;
  },

  /**
   * Extrait toutes les données de la page annonce
   * @returns {Object} - Données extraites
   */
  async extractAll() {
    // Attendre que la page soit chargée
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const criteria = this.extractCriteria();
    const priceDrop = this.calculatePriceDrop();
    const originalDate = this.extractOriginalDate();
    const listingAge = this.calculateListingAge();
    
    const data = {
      platform: this.platform,
      url: window.location.href,
      title: this.extractTitle(),
      price: this.extractPrice(),
      brand: this.extractBrand(),
      condition: this.extractCondition(),
      category: this.extractCategory(),
      location: this.extractLocation(),
      date: this.extractDate(),
      description: this.extractDescription(),
      image: this.extractImage(),
      seller: this.extractSeller(),
      criteria: criteria,
      
      // Nouvelles données: Ancien prix et date originale
      hasPriceDrop: this.hasPriceDrop(),
      priceDrop: priceDrop,
      oldPrice: priceDrop?.oldPrice || null,
      originalDate: originalDate,
      listingAge: listingAge,
      
      extractedAt: new Date().toISOString()
    };

    console.log('[ResellScout] Données LeBonCoin extraites:', data);
    
    // Injecter l'affichage de l'ancien prix et date sur la page
    this.injectPriceHistory(data);
    
    return data;
  },

  /**
   * Injecte l'affichage de l'ancien prix et de la date originale sur la page
   * @param {Object} data - Données extraites
   */
  injectPriceHistory(data) {
    // Supprimer l'ancien affichage s'il existe
    const existingBadge = document.getElementById('resellscout-price-history');
    if (existingBadge) existingBadge.remove();
    
    // Vérifier si on a des données à afficher
    const hasPriceDrop = data.priceDrop && data.priceDrop.oldPrice;
    const hasListingAge = data.listingAge && data.listingAge.days > 0;
    
    if (!hasPriceDrop && !hasListingAge) return;
    
    // Trouver où injecter (près du prix)
    const priceElement = this.findElement(this.selectors.price);
    if (!priceElement) return;
    
    // Créer le badge d'information
    const badge = document.createElement('div');
    badge.id = 'resellscout-price-history';
    badge.style.cssText = `
      margin-top: 12px;
      padding: 12px 16px;
      background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
      border: 1px solid #0ea5e9;
      border-radius: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      color: #0369a1;
      box-shadow: 0 2px 8px rgba(14, 165, 233, 0.15);
    `;
    
    let badgeContent = '<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;"><span style="font-size: 16px;">📊</span><strong style="color: #0c4a6e;">ResellScout - Historique</strong></div>';
    
    // Afficher l'ancien prix si disponible
    if (hasPriceDrop) {
      badgeContent += `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #bae6fd;">
          <span>🏷️ Ancien prix</span>
          <span style="font-weight: 600; color: #dc2626; text-decoration: line-through;">${data.priceDrop.oldPrice.toFixed(2)} €</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #bae6fd;">
          <span>📉 Baisse de prix</span>
          <span style="font-weight: 600; color: #16a34a;">-${data.priceDrop.dropAmount.toFixed(2)} € (-${data.priceDrop.dropPercent}%)</span>
        </div>
      `;
    }
    
    // Afficher la date de mise en ligne
    if (hasListingAge) {
      const ageColor = data.listingAge.isVeryOld ? '#dc2626' : (data.listingAge.isOld ? '#f59e0b' : '#16a34a');
      const ageIcon = data.listingAge.isVeryOld ? '⚠️' : (data.listingAge.isOld ? '⏰' : '📅');
      
      badgeContent += `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0;">
          <span>${ageIcon} En ligne depuis</span>
          <span style="font-weight: 600; color: ${ageColor};">${data.listingAge.text}</span>
        </div>
      `;
      
      if (data.listingAge.isOld) {
        badgeContent += `
          <div style="margin-top: 8px; padding: 8px; background: ${data.listingAge.isVeryOld ? '#fef2f2' : '#fffbeb'}; border-radius: 8px; font-size: 12px; color: ${data.listingAge.isVeryOld ? '#dc2626' : '#d97706'};">
            ${data.listingAge.isVeryOld ? '⚠️ Annonce très ancienne - possibilité de négocier!' : '💡 Annonce ancienne - le vendeur pourrait accepter une offre'}
          </div>
        `;
      }
    }
    
    badge.innerHTML = badgeContent;
    
    // Insérer après le prix
    const priceContainer = priceElement.closest('div') || priceElement.parentElement;
    if (priceContainer) {
      priceContainer.insertAdjacentElement('afterend', badge);
    } else {
      priceElement.insertAdjacentElement('afterend', badge);
    }
    
    console.log('[ResellScout] Badge historique de prix injecté');
  },

  /**
   * Vérifie si on est sur une page annonce LeBonCoin
   * @returns {boolean}
   */
  isProductPage() {
    return window.location.pathname.includes('/ad/') || 
           window.location.pathname.match(/\/[a-z]+\/\d+\.htm/);
  }
};

// Export global
window.LeBonCoinScraper = LeBonCoinScraper;
