/**
 * ResellScout - Scraper Vinted v2.1
 * Extraction des données depuis les pages produit Vinted
 * Mise à jour: Décembre 2025
 */

const VintedScraper = {
  platform: 'vinted',
  
  /**
   * Attend qu'un élément soit visible sur la page
   * @param {number} timeout - Temps max en ms
   * @returns {Promise<boolean>}
   */
  async waitForContent(timeout = 5000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      // Chercher un prix sur la page
      const priceMatch = document.body.innerText.match(/\d{1,5}[,.]\d{2}\s*€/);
      // Chercher un h1
      const h1 = document.querySelector('h1');
      
      if (priceMatch && h1 && h1.textContent.trim().length > 3) {
        console.log('[ResellScout] Contenu détecté après', Date.now() - startTime, 'ms');
        return true;
      }
      
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log('[ResellScout] Timeout en attente du contenu');
    return false;
  },
  
  /**
   * Sélecteurs CSS pour Vinted (mis à jour décembre 2025)
   */
  selectors: {
    // Titre de l'article - multiples sélecteurs pour robustesse
    title: [
      '[data-testid="item-title"]',
      '[itemprop="name"]',
      'h1.web_ui__Text__text',
      '.item-details h1',
      '.ItemBox_title__f3nxP',
      'h1[class*="Text"]',
      'h1',
      // Sélecteurs basés sur la structure actuelle
      '[class*="ItemDetails"] h1',
      '[class*="item-page"] h1',
      '.details-list--main h1'
    ],
    
    // Prix de l'article
    price: [
      '[data-testid="item-price"]',
      '[itemprop="price"]',
      '[class*="ItemPrice"]',
      '.item-price',
      '.web_ui__Text__text.web_ui__Text__heading.web_ui__Text__bold',
      '[class*="price"]',
      // Sélecteurs avec structure spécifique
      '[class*="Price"] [class*="Text"]',
      'h1 + div [class*="Text"]'
    ],
    
    // Marque
    brand: [
      '[data-testid="item-brand"]',
      '[itemprop="brand"]',
      'a[href*="/brand/"]',
      '[class*="brand"]',
      '.details-list__item-value a[href*="/brand/"]'
    ],
    
    // État de l'article
    condition: [
      '[data-testid="item-condition"]',
      '[data-testid="item-attributes-status"]',
      '[class*="status"]',
      '[class*="condition"]'
    ],
    
    // Taille
    size: [
      '[data-testid="item-size"]',
      '[data-testid="item-attributes-size"]',
      '[class*="size"]'
    ],
    
    // Catégorie (breadcrumbs)
    category: [
      '[data-testid="item-category"]',
      'nav[aria-label*="breadcrumb"] a',
      '[class*="Breadcrumb"] a',
      '.breadcrumbs a'
    ],
    
    // Image principale
    image: [
      '[data-testid="item-photo-0"] img',
      '[class*="Gallery"] img',
      '[class*="ItemPhoto"] img',
      '.item-photos img',
      'img[src*="images.vinted"]'
    ],
    
    // Vendeur
    seller: [
      '[data-testid="owner-username"]',
      '[class*="UserName"]',
      'a[href*="/member/"]',
      '.user-login-name'
    ],
    
    // Localisation
    location: [
      '[data-testid="item-location"]',
      '[data-testid="item-attributes-location"]',
      '[class*="location"]'
    ],
    
    // Conteneur des détails
    detailsContainer: [
      '[class*="ItemDetails"]',
      '[class*="details-list"]',
      '[class*="item-details"]',
      '[data-testid="item-details"]'
    ]
  },

  /**
   * Trouve un élément avec plusieurs sélecteurs possibles
   * @param {string[]} selectors - Liste de sélecteurs à essayer
   * @returns {Element|null}
   */
  findElement(selectors) {
    for (const selector of selectors) {
      try {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim()) return element;
      } catch (e) {
        // Sélecteur invalide, continuer
      }
    }
    return null;
  },

  /**
   * Trouve tous les éléments avec plusieurs sélecteurs
   * @param {string[]} selectors
   * @returns {Element[]}
   */
  findElements(selectors) {
    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) return Array.from(elements);
      } catch (e) {
        // Continuer
      }
    }
    return [];
  },

  /**
   * Extrait le texte d'un élément
   * @param {string[]} selectors
   * @returns {string|null}
   */
  extractText(selectors) {
    const element = this.findElement(selectors);
    if (!element) return null;
    return this.cleanString(element.textContent);
  },

  /**
   * Nettoie une chaîne de caractères
   * @param {string} str
   * @returns {string}
   */
  cleanString(str) {
    if (!str) return '';
    return str.replace(/\s+/g, ' ').trim();
  },

  /**
   * Parse un prix depuis un texte
   * @param {string} text
   * @returns {number|null}
   */
  parsePrice(text) {
    if (!text) return null;
    // Supprimer tout sauf les chiffres, virgules et points
    const cleaned = text.replace(/[^\d,.\s]/g, '').trim();
    // Remplacer la virgule par un point
    const normalized = cleaned.replace(',', '.');
    // Extraire le premier nombre valide
    const match = normalized.match(/(\d+\.?\d*)/);
    if (match) {
      const price = parseFloat(match[1]);
      return isNaN(price) ? null : price;
    }
    return null;
  },

  /**
   * Extrait les données depuis le JSON-LD de la page
   * @returns {Object|null}
   */
  extractFromJsonLd() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);
        
        // Chercher le produit
        if (data['@type'] === 'Product') {
          return {
            title: data.name,
            price: data.offers?.price ? parseFloat(data.offers.price) : null,
            brand: data.brand?.name || data.brand,
            condition: data.itemCondition,
            image: data.image?.[0] || data.image,
            description: data.description,
            seller: data.offers?.seller?.name
          };
        }
        
        // Si c'est un tableau
        if (Array.isArray(data)) {
          const product = data.find(d => d['@type'] === 'Product');
          if (product) {
            return {
              title: product.name,
              price: product.offers?.price ? parseFloat(product.offers.price) : null,
              brand: product.brand?.name || product.brand,
              condition: product.itemCondition,
              image: product.image?.[0] || product.image,
              description: product.description,
              seller: product.offers?.seller?.name
            };
          }
        }
      } catch (e) {
        // Erreur de parsing, continuer
      }
    }
    return null;
  },

  /**
   * Extrait les données depuis les meta tags
   * @returns {Object}
   */
  extractFromMeta() {
    const getMeta = (name) => {
      const meta = document.querySelector(`meta[property="${name}"], meta[name="${name}"]`);
      return meta ? meta.getAttribute('content') : null;
    };

    return {
      title: getMeta('og:title') || getMeta('twitter:title'),
      price: this.parsePrice(getMeta('og:price:amount') || getMeta('product:price:amount')),
      image: getMeta('og:image') || getMeta('twitter:image'),
      description: getMeta('og:description') || getMeta('description')
    };
  },

  /**
   * Extrait les données depuis le __NEXT_DATA__ (si présent - Next.js)
   * @returns {Object|null}
   */
  extractFromNextData() {
    const nextDataScript = document.getElementById('__NEXT_DATA__');
    if (!nextDataScript) return null;
    
    try {
      const data = JSON.parse(nextDataScript.textContent);
      const pageProps = data.props?.pageProps;
      
      if (pageProps?.item) {
        const item = pageProps.item;
        return {
          title: item.title,
          price: item.price ? parseFloat(item.price) : (item.total_item_price ? parseFloat(item.total_item_price) : null),
          brand: item.brand_title || item.brand?.title,
          condition: item.status,
          size: item.size_title || item.size,
          category: item.catalog_title || item.category?.title,
          image: item.photos?.[0]?.url || item.photo?.url,
          seller: item.user?.login,
          location: item.city || item.user?.city
        };
      }
    } catch (e) {
      console.log('[ResellScout] Erreur parsing NEXT_DATA:', e);
    }
    return null;
  },

  /**
   * Extrait les données depuis la window.__PRELOADED_STATE__ (Redux)
   * @returns {Object|null}
   */
  extractFromPreloadedState() {
    try {
      // Chercher dans les scripts inline
      const scripts = document.querySelectorAll('script:not([src])');
      for (const script of scripts) {
        const content = script.textContent;
        
        // Chercher window.__PRELOADED_STATE__ ou window.__INITIAL_STATE__
        if (content.includes('__PRELOADED_STATE__') || content.includes('__INITIAL_STATE__')) {
          const match = content.match(/window\.__(?:PRELOADED|INITIAL)_STATE__\s*=\s*({.*?});/s);
          if (match) {
            const state = JSON.parse(match[1]);
            // Navigation dans l'état Redux pour trouver l'item
            const item = state.items?.current || state.item || state.page?.item;
            if (item) {
              return {
                title: item.title,
                price: parseFloat(item.price || item.total_item_price),
                brand: item.brand_title,
                condition: item.status,
                image: item.photos?.[0]?.url
              };
            }
          }
        }
      }
    } catch (e) {
      console.log('[ResellScout] Erreur extraction state:', e);
    }
    return null;
  },

  /**
   * Extrait le titre avec plusieurs méthodes
   * @returns {string|null}
   */
  extractTitle() {
    // Méthode 1: Chercher le h1 principal (le plus fiable sur Vinted)
    const h1Elements = document.querySelectorAll('h1');
    for (const h1 of h1Elements) {
      const text = this.cleanString(h1.textContent);
      // Ignorer les h1 qui contiennent "Vinted" ou sont trop courts
      if (text && text.length > 3 && !text.toLowerCase().includes('vinted') && !text.includes('Frais')) {
        console.log('[ResellScout] Titre trouvé via h1:', text);
        return text;
      }
    }
    
    // Méthode 2: Sélecteurs directs
    let title = this.extractText(this.selectors.title);
    if (title && title.length > 2 && !title.includes('Vinted')) return title;
    
    // Méthode 3: Titre de la page (nettoyer "| Vinted")
    const pageTitle = document.title;
    if (pageTitle) {
      // Format typique: "Nom du produit | Vinted"
      const parts = pageTitle.split('|');
      if (parts.length > 0) {
        title = parts[0].trim();
        if (title && title.length > 2 && !title.toLowerCase().includes('vinted')) {
          console.log('[ResellScout] Titre trouvé via document.title:', title);
          return title;
        }
      }
    }
    
    // Méthode 4: Extraire depuis l'URL
    const urlMatch = window.location.pathname.match(/\/items\/\d+-(.+)/);
    if (urlMatch) {
      title = decodeURIComponent(urlMatch[1]).replace(/-/g, ' ');
      console.log('[ResellScout] Titre trouvé via URL:', title);
      return title;
    }
    
    return null;
  },

  /**
   * Extrait le prix avec plusieurs méthodes
   * @returns {number|null}
   */
  extractPrice() {
    console.log('[ResellScout] Extraction du prix...');
    
    // Méthode 1: Chercher via sélecteurs spécifiques d'abord
    // Sur Vinted le prix est souvent dans un élément avec une classe contenant "price"
    const priceSelectors = [
      '[data-testid="item-price"]',
      '[data-testid*="price"]',
      '[class*="ItemPrice"]',
      '[class*="item-price"]',
      '.new-item-box__price',
      '[itemprop="price"]',
      // Sélecteurs basés sur les classes Vinted
      'h1 + div [class*="Text"]', // Le prix est souvent juste après le titre
      '[class*="price__"] span',
      '[class*="web_ui__Text--title"][class*="web_ui__Text--bold"]'
    ];
    
    for (const selector of priceSelectors) {
      try {
        const element = document.querySelector(selector);
        if (element) {
          const price = this.parsePrice(element.textContent);
          if (price && price > 0 && price < 50000) {
            console.log('[ResellScout] Prix trouvé via sélecteur', selector, ':', price);
            return price;
          }
        }
      } catch (e) {}
    }
    
    // Méthode 2: Chercher les éléments qui contiennent UNIQUEMENT un prix (format XX,XX €)
    const allElements = document.querySelectorAll('span, div, p');
    for (const el of allElements) {
      const text = el.textContent.trim();
      // Match exact d'un prix avec €
      if (/^\d{1,5}[,.]\d{2}\s*€$/.test(text) || /^\d{1,5}\s*€$/.test(text)) {
        const price = this.parsePrice(text);
        if (price && price > 0 && price < 50000) {
          // Vérifier que ce n'est pas un frais de port
          const parentText = el.closest('div')?.textContent?.toLowerCase() || '';
          const siblingText = el.parentElement?.textContent?.toLowerCase() || '';
          
          if (!siblingText.includes('envoi') && !siblingText.includes('livraison') &&
              !siblingText.includes('à partir de') && !parentText.includes('frais de port')) {
            // Vérifier si c'est le prix principal (généralement le premier grand prix)
            const fontSize = window.getComputedStyle(el).fontSize;
            const fontSizeNum = parseFloat(fontSize);
            if (fontSizeNum >= 14) { // Prix principal généralement en plus grand
              console.log('[ResellScout] Prix trouvé via élément isolé:', price);
              return price;
            }
          }
        }
      }
    }
    
    // Méthode 3: Chercher dans le texte complet le premier prix raisonnable
    const allText = document.body.innerText;
    const lines = allText.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      // Ligne qui ressemble à un prix seul (ex: "90,99 €")
      if (/^\d{1,5}[,.]\d{2}\s*€/.test(trimmedLine)) {
        const price = this.parsePrice(trimmedLine);
        if (price && price > 0 && price < 50000) {
          console.log('[ResellScout] Prix trouvé via ligne:', price);
          return price;
        }
      }
    }
    
    // Méthode 4: Regex plus large sur tout le contenu
    const pricePattern = /(\d{1,5}[,.]\d{2})\s*€/g;
    const matches = [...allText.matchAll(pricePattern)];
    
    for (const match of matches) {
      const price = this.parsePrice(match[1]);
      const contextBefore = allText.substring(Math.max(0, match.index - 50), match.index).toLowerCase();
      
      // Ignorer si c'est un frais de port ou protection
      if (contextBefore.includes('envoi') || contextBefore.includes('livraison') || 
          contextBefore.includes('partir de') || contextBefore.includes('frais')) {
        continue;
      }
      
      if (price && price > 0 && price < 50000) {
        console.log('[ResellScout] Prix trouvé via regex:', price);
        return price;
      }
    }
    
    return null;
  },

  /**
   * Extrait la marque
   * @returns {string|null}
   */
  extractBrand() {
    // Sélecteurs directs
    let brand = this.extractText(this.selectors.brand);
    if (brand) return brand;
    
    // Chercher dans les liens vers /brand/
    const brandLink = document.querySelector('a[href*="/brand/"]');
    if (brandLink) {
      return this.cleanString(brandLink.textContent);
    }
    
    // Chercher dans les détails
    const allText = document.body.innerText;
    const brandMatch = allText.match(/Marque\s*:?\s*([^\n]+)/i);
    if (brandMatch) {
      return this.cleanString(brandMatch[1]);
    }
    
    return null;
  },

  /**
   * Extrait l'état de l'article
   * @returns {string|null}
   */
  extractCondition() {
    // Sélecteurs directs
    let condition = this.extractText(this.selectors.condition);
    if (condition) return condition;
    
    // Chercher dans le texte
    const conditions = ['Neuf avec étiquette', 'Neuf sans étiquette', 'Très bon état', 'Bon état', 'Satisfaisant'];
    const bodyText = document.body.innerText;
    
    for (const cond of conditions) {
      if (bodyText.includes(cond)) {
        return cond;
      }
    }
    
    return null;
  },

  /**
   * Extrait la taille
   * @returns {string|null}
   */
  extractSize() {
    let size = this.extractText(this.selectors.size);
    if (size) return size;
    
    // Chercher "Taille" dans le texte
    const allText = document.body.innerText;
    const sizeMatch = allText.match(/Taille\s*:?\s*([^\n]+)/i);
    if (sizeMatch) {
      return this.cleanString(sizeMatch[1]);
    }
    
    return null;
  },

  /**
   * Extrait la catégorie
   * @returns {string|null}
   */
  extractCategory() {
    const breadcrumbs = this.findElements(this.selectors.category);
    if (breadcrumbs.length > 0) {
      const categories = breadcrumbs.map(el => el.textContent.trim()).filter(t => t);
      return categories.join(' > ');
    }
    return null;
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
    
    // Chercher une image Vinted
    const vintedImg = document.querySelector('img[src*="vinted"], img[src*="images.vinted"]');
    if (vintedImg) return vintedImg.src;
    
    return null;
  },

  /**
   * Extrait le nom du vendeur
   * @returns {string|null}
   */
  extractSeller() {
    let seller = this.extractText(this.selectors.seller);
    if (seller) return seller;
    
    // Chercher un lien vers /member/
    const memberLink = document.querySelector('a[href*="/member/"]');
    if (memberLink) {
      return this.cleanString(memberLink.textContent);
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
   * Extrait toutes les données de la page produit
   * @returns {Promise<Object>}
   */
  async extractAll() {
    console.log('[ResellScout] Début extraction Vinted...');
    console.log('[ResellScout] URL:', window.location.href);
    
    // Attendre que la page soit bien chargée avec du contenu
    await this.waitForContent(5000);
    
    console.log('[ResellScout] Document title:', document.title);
    
    // Debug: Afficher les premiers h1 trouvés
    const h1s = document.querySelectorAll('h1');
    console.log('[ResellScout] H1s trouvés:', h1s.length);
    h1s.forEach((h1, i) => console.log(`[ResellScout]   H1[${i}]:`, h1.textContent.trim().substring(0, 50)));
    
    // Essayer d'abord les sources de données structurées
    let structuredData = this.extractFromNextData() || 
                          this.extractFromJsonLd() || 
                          this.extractFromPreloadedState();
    
    const metaData = this.extractFromMeta();
    
    if (structuredData) {
      console.log('[ResellScout] Données structurées trouvées:', structuredData);
    }
    if (metaData && (metaData.title || metaData.price)) {
      console.log('[ResellScout] Meta données trouvées:', metaData);
    }
    
    // Extraire depuis le DOM
    const domTitle = this.extractTitle();
    const domPrice = this.extractPrice();
    
    console.log('[ResellScout] DOM - Titre:', domTitle);
    console.log('[ResellScout] DOM - Prix:', domPrice);
    
    // Construire les données avec fallbacks
    const data = {
      platform: this.platform,
      url: window.location.href,
      title: domTitle || structuredData?.title || metaData?.title || null,
      price: domPrice ?? structuredData?.price ?? metaData?.price ?? null,
      brand: this.extractBrand() || structuredData?.brand || null,
      condition: this.extractCondition() || structuredData?.condition || null,
      size: this.extractSize() || structuredData?.size || null,
      category: this.extractCategory() || structuredData?.category || null,
      image: this.extractImage() || structuredData?.image || metaData?.image || null,
      seller: this.extractSeller() || structuredData?.seller || null,
      location: this.extractLocation() || structuredData?.location || null,
      description: structuredData?.description || metaData?.description || null,
      extractedAt: new Date().toISOString()
    };

    console.log('[ResellScout] Données finales:', data);
    
    // Si toujours pas de titre, extraire depuis l'URL
    if (!data.title) {
      const urlMatch = window.location.pathname.match(/\/items\/\d+-(.+)/);
      if (urlMatch) {
        data.title = decodeURIComponent(urlMatch[1]).replace(/-/g, ' ');
        console.log('[ResellScout] Titre extrait de URL:', data.title);
      }
    }
    
    // Si toujours pas de prix, dernière tentative
    if (data.price === null) {
      console.log('[ResellScout] Dernière tentative extraction prix...');
      const bodyText = document.body.innerText;
      // Chercher le premier prix raisonnable
      const allPrices = [...bodyText.matchAll(/(\d{1,5})[,.](\d{2})\s*€/g)];
      for (const match of allPrices) {
        const price = parseFloat(`${match[1]}.${match[2]}`);
        if (price > 1 && price < 50000) {
          data.price = price;
          console.log('[ResellScout] Prix trouvé (fallback):', price);
          break;
        }
      }
    }
    
    return data;
  },

  /**
   * Vérifie si on est sur une page produit Vinted
   * @returns {boolean}
   */
  isProductPage() {
    const path = window.location.pathname;
    return path.includes('/items/') || 
           path.match(/\/[a-z]{2}\/items\//) !== null;
  }
};

// Export global
window.VintedScraper = VintedScraper;
