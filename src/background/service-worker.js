/**
 * ResellScout - Service Worker v6.0
 * 100% Prix Réels - Sources: Vinted, LeBonCoin et eBay
 * Architecture: Requêtes cross-origin depuis le service worker
 */

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  REQUEST_DELAY: 300,
  TIMEOUT: 12000,
  MAX_RESULTS: 25
};

// ============================================
// RECHERCHE PRIX - VINTED (via API mobile)
// ============================================

async function searchVintedPrices(query, options = {}) {
  const results = {
    source: 'Vinted',
    prices: [],
    avgPrice: null,
    minPrice: null,
    maxPrice: null,
    count: 0,
    success: false,
    error: null
  };

  try {
    const cleanQuery = query.replace(/[^\w\s\-àâäéèêëïîôùûüç]/gi, ' ').trim();
    console.log('[ResellScout] Recherche Vinted:', cleanQuery);

    // Utiliser l'API web de Vinted
    const searchUrl = `https://www.vinted.fr/api/v2/catalog/items?page=1&per_page=${CONFIG.MAX_RESULTS}&search_text=${encodeURIComponent(cleanQuery)}&catalog_ids=&order=relevance&status_ids=&brand_ids=`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT);

    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'fr',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      mode: 'cors',
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    console.log('[ResellScout] Vinted response status:', response.status);

    if (!response.ok) {
      // Si l'API échoue, essayer de scraper la page HTML
      return await scrapeVintedHTML(cleanQuery);
    }

    const data = await response.json();
    console.log('[ResellScout] Vinted data:', data);
    
    const items = data.items || [];
    
    if (items.length > 0) {
      results.prices = items
        .filter(item => {
          const price = parseFloat(item.price || item.total_item_price || 0);
          return price > 0;
        })
        .map(item => ({
          price: parseFloat(item.price || item.total_item_price),
          title: item.title || 'Article Vinted',
          url: item.url || `https://www.vinted.fr/items/${item.id}`,
          condition: item.status,
          brand: item.brand_title,
          image: item.photo?.url || item.photos?.[0]?.url || null
        }));

      if (results.prices.length > 0) {
        const priceValues = results.prices.map(p => p.price);
        results.minPrice = Math.min(...priceValues);
        results.maxPrice = Math.max(...priceValues);
        results.avgPrice = Math.round(priceValues.reduce((a, b) => a + b, 0) / priceValues.length);
        results.count = results.prices.length;
        results.success = true;
        console.log('[ResellScout] Vinted succès:', results.count, 'articles');
      }
    }

    if (!results.success) {
      // Fallback: scraper HTML
      return await scrapeVintedHTML(cleanQuery);
    }

  } catch (error) {
    console.warn('[ResellScout] Erreur Vinted API:', error.message);
    // Fallback: scraper HTML
    try {
      return await scrapeVintedHTML(query);
    } catch (e) {
      results.error = error.message;
    }
  }

  return results;
}

// Fallback: Scraper HTML Vinted
async function scrapeVintedHTML(query) {
  const results = {
    source: 'Vinted',
    prices: [],
    avgPrice: null,
    minPrice: null,
    maxPrice: null,
    count: 0,
    success: false,
    error: null
  };

  try {
    const cleanQuery = encodeURIComponent(query.trim());
    const searchUrl = `https://www.vinted.fr/catalog?search_text=${cleanQuery}`;
    
    console.log('[ResellScout] Scraping Vinted HTML:', searchUrl);

    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    console.log('[ResellScout] Vinted HTML reçu, taille:', html.length);

    // Chercher les données JSON dans le HTML
    // Vinted stocke les données dans un script avec les props
    const patterns = [
      /"items"\s*:\s*(\[[\s\S]*?\])\s*[,}]/,
      /window\.__PRELOADED_STATE__\s*=\s*({[\s\S]*?});/,
      /<script[^>]*>[\s\S]*?"catalogItems"[\s\S]*?(\[[\s\S]*?\])[\s\S]*?<\/script>/
    ];

    let items = [];

    // Pattern 1: Chercher des prix dans le HTML
    const priceMatches = html.matchAll(/(\d+(?:[,\.]\d{2})?)\s*€/g);
    const prices = [];
    for (const match of priceMatches) {
      const price = parseFloat(match[1].replace(',', '.'));
      if (price >= 1 && price <= 10000 && !prices.includes(price)) {
        prices.push(price);
      }
    }

    // Pattern 2: Essayer d'extraire les données structurées
    const jsonMatch = html.match(/"items"\s*:\s*\[([\s\S]*?)\]\s*,\s*"pagination"/);
    if (jsonMatch) {
      try {
        const itemsJson = JSON.parse('[' + jsonMatch[1] + ']');
        items = itemsJson;
      } catch (e) {
        console.log('[ResellScout] Erreur parsing JSON items');
      }
    }

    // Si on a trouvé des items structurés
    if (items.length > 0) {
      results.prices = items.slice(0, CONFIG.MAX_RESULTS).map(item => ({
        price: parseFloat(item.price || item.total_item_price || 0),
        title: item.title || 'Article Vinted',
        url: `https://www.vinted.fr/items/${item.id}`,
        image: item.photo?.url || null
      })).filter(p => p.price > 0);
    } 
    // Sinon utiliser les prix extraits
    else if (prices.length > 0) {
      results.prices = prices.slice(0, CONFIG.MAX_RESULTS).map((price, i) => ({
        price: price,
        title: `Article Vinted #${i + 1}`,
        url: 'https://www.vinted.fr',
        image: null
      }));
    }

    if (results.prices.length > 0) {
      const priceValues = results.prices.map(p => p.price);
      results.minPrice = Math.min(...priceValues);
      results.maxPrice = Math.max(...priceValues);
      results.avgPrice = Math.round(priceValues.reduce((a, b) => a + b, 0) / priceValues.length);
      results.count = results.prices.length;
      results.success = true;
      console.log('[ResellScout] Vinted HTML succès:', results.count, 'prix trouvés');
    } else {
      results.error = 'Aucun prix trouvé dans le HTML';
    }

  } catch (error) {
    results.error = error.message;
    console.warn('[ResellScout] Erreur scraping Vinted:', error.message);
  }

  return results;
}

// ============================================
// RECHERCHE PRIX - EBAY
// ============================================

async function searchEbayPrices(query, options = {}) {
  const results = {
    source: 'eBay',
    prices: [],
    avgPrice: null,
    minPrice: null,
    maxPrice: null,
    count: 0,
    success: false,
    error: null
  };

  try {
    const cleanQuery = query.replace(/[^\w\s\-àâäéèêëïîôùûüç]/gi, ' ').trim();
    console.log('[ResellScout] Recherche eBay:', cleanQuery);

    // eBay France - occasion seulement (LH_ItemCondition=3000 = occasion)
    const searchUrl = `https://www.ebay.fr/sch/i.html?_nkw=${encodeURIComponent(cleanQuery)}&_sop=12&LH_ItemCondition=3000&_ipg=50&rt=nc`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT);

    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`eBay HTTP ${response.status}`);
    }

    const html = await response.text();
    console.log('[ResellScout] eBay HTML reçu, taille:', html.length);

    // Parser les résultats eBay
    const items = [];

    // Méthode 1: Extraire les prix avec regex
    // Format typique: <span class="s-item__price">XX,XX EUR</span>
    const priceRegex = /class="s-item__price"[^>]*>\s*(\d+(?:[,\.]\d{2})?)\s*EUR/gi;
    const titleRegex = /class="s-item__title"[^>]*>(?:<span[^>]*>)?([^<]+)/gi;
    const linkRegex = /class="s-item__link"[^>]*href="([^"]+)"/gi;
    const imgRegex = /class="s-item__image-img"[^>]*src="([^"]+)"/gi;

    // Split par item
    const itemBlocks = html.split(/class="s-item\s+s-item/gi).slice(1);
    
    for (const block of itemBlocks) {
      try {
        // Prix
        const priceMatch = block.match(/class="s-item__price"[^>]*>\s*(\d+(?:[,\.]\d{2})?)\s*EUR/i);
        if (!priceMatch) continue;
        
        const price = parseFloat(priceMatch[1].replace(',', '.'));
        if (price <= 0 || isNaN(price)) continue;

        // Titre
        const titleMatch = block.match(/class="s-item__title"[^>]*>(?:<span[^>]*>)?([^<]+)/i);
        let title = titleMatch ? titleMatch[1].trim() : 'Article eBay';
        
        // Ignorer "Shop on eBay" et items vides
        if (title.toLowerCase().includes('shop on ebay') || title.length < 3) continue;

        // Lien
        const linkMatch = block.match(/href="(https:\/\/www\.ebay\.fr\/itm\/[^"]+)"/i);
        const url = linkMatch ? linkMatch[1].split('?')[0] : 'https://www.ebay.fr';

        // Image
        const imgMatch = block.match(/src="(https:\/\/i\.ebayimg\.com[^"]+)"/i);
        const image = imgMatch ? imgMatch[1] : null;

        items.push({ price, title, url, image });
      } catch (e) {
        // Ignorer les erreurs de parsing
      }
    }

    // Méthode 2: Extraire simplement les prix si pas d'items structurés
    if (items.length === 0) {
      const allPrices = [];
      const simplePrice = html.matchAll(/(\d+(?:[,\.]\d{2})?)\s*EUR/g);
      for (const match of simplePrice) {
        const price = parseFloat(match[1].replace(',', '.'));
        if (price >= 5 && price <= 10000 && !allPrices.includes(price)) {
          allPrices.push(price);
        }
      }
      
      for (const price of allPrices.slice(0, CONFIG.MAX_RESULTS)) {
        items.push({
          price,
          title: 'Article eBay',
          url: 'https://www.ebay.fr',
          image: null
        });
      }
    }

    if (items.length > 0) {
      results.prices = items.filter(item => item.price > 0);
      
      if (results.prices.length > 0) {
        const priceValues = results.prices.map(p => p.price);
        results.minPrice = Math.min(...priceValues);
        results.maxPrice = Math.max(...priceValues);
        results.avgPrice = Math.round(priceValues.reduce((a, b) => a + b, 0) / priceValues.length);
        results.count = results.prices.length;
        results.success = true;
        console.log('[ResellScout] eBay succès:', results.count, 'articles');
      }
    }

    if (!results.success) {
      results.error = 'Aucun résultat trouvé';
    }

  } catch (error) {
    results.error = error.message;
    console.warn('[ResellScout] Erreur eBay:', error.message);
  }

  return results;
}

// ============================================
// RECHERCHE PRIX - LEBONCOIN API
// ============================================

async function searchLeBonCoinPrices(query, options = {}) {
  const results = {
    source: 'LeBonCoin',
    prices: [],
    avgPrice: null,
    minPrice: null,
    maxPrice: null,
    count: 0,
    success: false,
    error: null
  };

  try {
    const cleanQuery = query.replace(/[^\w\s\-àâäéèêëïîôùûüç]/gi, ' ').trim();
    console.log('[ResellScout] Recherche LeBonCoin:', cleanQuery);

    const requestBody = {
      limit: CONFIG.MAX_RESULTS,
      limit_alu: 3,
      filters: {
        category: {},
        keywords: { text: cleanQuery },
        ranges: {}
      },
      sort_by: 'relevance',
      sort_order: 'desc'
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT);

    const response = await fetch('https://api.leboncoin.fr/finder/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'api_key': 'ba0c2dad52b3ec',
        'Origin': 'https://www.leboncoin.fr',
        'Referer': 'https://www.leboncoin.fr/'
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    console.log('[ResellScout] LeBonCoin response status:', response.status);

    if (!response.ok) {
      // Fallback: scraper HTML
      return await scrapeLeBonCoinHTML(cleanQuery);
    }

    const data = await response.json();
    
    if (data.ads && data.ads.length > 0) {
      results.prices = data.ads
        .filter(ad => ad.price && ad.price[0])
        .map(ad => ({
          price: parseFloat(ad.price[0]),
          title: ad.subject || 'Annonce LeBonCoin',
          url: ad.url || 'https://www.leboncoin.fr',
          location: ad.location?.city,
          image: ad.images?.urls?.[0] || ad.images?.thumb_url || null
        }))
        .filter(item => item.price > 0);

      if (results.prices.length > 0) {
        const priceValues = results.prices.map(p => p.price);
        results.minPrice = Math.min(...priceValues);
        results.maxPrice = Math.max(...priceValues);
        results.avgPrice = Math.round(priceValues.reduce((a, b) => a + b, 0) / priceValues.length);
        results.count = results.prices.length;
        results.success = true;
        console.log('[ResellScout] LeBonCoin succès:', results.count, 'annonces');
      }
    }

    if (!results.success) {
      return await scrapeLeBonCoinHTML(cleanQuery);
    }

  } catch (error) {
    console.warn('[ResellScout] Erreur LeBonCoin API:', error.message);
    try {
      return await scrapeLeBonCoinHTML(query);
    } catch (e) {
      results.error = error.message;
    }
  }

  return results;
}

// Fallback: Scraper HTML LeBonCoin
async function scrapeLeBonCoinHTML(query) {
  const results = {
    source: 'LeBonCoin',
    prices: [],
    avgPrice: null,
    minPrice: null,
    maxPrice: null,
    count: 0,
    success: false,
    error: null
  };

  try {
    const cleanQuery = encodeURIComponent(query.trim());
    const searchUrl = `https://www.leboncoin.fr/recherche?text=${cleanQuery}`;
    
    console.log('[ResellScout] Scraping LeBonCoin HTML');

    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    console.log('[ResellScout] LeBonCoin HTML reçu, taille:', html.length);

    // Extraire les prix du HTML
    const priceMatches = html.matchAll(/(\d+(?:\s\d{3})*)\s*€/g);
    const prices = [];
    
    for (const match of priceMatches) {
      const priceStr = match[1].replace(/\s/g, '');
      const price = parseFloat(priceStr);
      if (price >= 1 && price <= 50000 && !prices.includes(price)) {
        prices.push(price);
      }
    }

    if (prices.length > 0) {
      results.prices = prices.slice(0, CONFIG.MAX_RESULTS).map((price, i) => ({
        price: price,
        title: `Annonce LeBonCoin #${i + 1}`,
        url: 'https://www.leboncoin.fr',
        image: null
      }));

      const priceValues = results.prices.map(p => p.price);
      results.minPrice = Math.min(...priceValues);
      results.maxPrice = Math.max(...priceValues);
      results.avgPrice = Math.round(priceValues.reduce((a, b) => a + b, 0) / priceValues.length);
      results.count = results.prices.length;
      results.success = true;
      console.log('[ResellScout] LeBonCoin HTML succès:', results.count, 'prix');
    } else {
      results.error = 'Aucun prix trouvé';
    }

  } catch (error) {
    results.error = error.message;
    console.warn('[ResellScout] Erreur scraping LeBonCoin:', error.message);
  }

  return results;
}

// ============================================
// EXTRACTION DES MOTS-CLÉS IMPORTANTS
// ============================================

function extractKeywords(title) {
  if (!title) return { model: null, brand: null, keywords: [], numbers: [], searchQuery: null };
  
  let normalized = title.toLowerCase().trim();
  
  // Normaliser les variantes CPU Intel
  normalized = normalized
    .replace(/core\s*/gi, '')
    .replace(/processeur\s*/gi, '')
    .replace(/processor\s*/gi, '')
    .replace(/\bi\s*([3579])\b/gi, 'i$1')
    .replace(/(\d{4,5})\s*([kfx]+)\b/gi, '$1$2')
    .replace(/(\d{4,5})\s+([kfx])\s+([kfx])\b/gi, '$1$2$3')
    .replace(/\(.*?\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  console.log('[ResellScout] Titre normalisé:', normalized);
  
  // Patterns pour modèles
  const modelPatterns = [
    /\b(rtx|gtx)\s*(\d{3,4})\s*(ti|super)?\b/gi,
    /\b(rx)\s*(\d{3,4})\s*(xt|xtx)?\b/gi,
    /\b(i[3579])\s*[-]?\s*(\d{4,5})([kfx]*)\b/gi,
    /\b(ryzen\s*[3579])\s*(\d{4}[a-z]*)\b/gi,
    /\b(iphone|ipad)\s*(\d{1,2})\s*(pro|max|plus|mini)?\b/gi,
    /\b(galaxy)\s*(s|a|z)?\s*(\d{1,2})\s*(ultra|plus)?\b/gi,
    /\b(ps[45]|playstation\s*[45])\s*(pro|slim)?\b/gi,
    /\b(xbox)\s*(series\s*[xs]|one)?\b/gi,
    /\b(switch)\s*(oled|lite)?\b/gi,
  ];
  
  let modelMatch = null;
  for (const pattern of modelPatterns) {
    const match = normalized.match(pattern);
    if (match && match[0]) {
      modelMatch = match[0].replace(/\s+/g, ' ').trim();
      break;
    }
  }
  
  // CPU pattern
  if (!modelMatch) {
    const cpuMatch = normalized.match(/i([3579])\s*[-]?\s*(\d{4,5})([kfx]*)/i);
    if (cpuMatch) {
      modelMatch = `i${cpuMatch[1]} ${cpuMatch[2]}${cpuMatch[3] || ''}`.trim();
    }
  }
  
  // Extraire les nombres
  const numbers = [];
  const numberMatches = normalized.match(/\b\d{4,5}[a-z]*\b/gi) || [];
  numberMatches.forEach(n => {
    if (!numbers.includes(n.toLowerCase())) {
      numbers.push(n.toLowerCase());
    }
  });
  
  // Marques connues
  const brands = ['nvidia', 'amd', 'intel', 'apple', 'samsung', 'sony', 'microsoft', 'nintendo', 'asus', 'msi', 'gigabyte', 'evga', 'zotac', 'google', 'xiaomi', 'huawei'];
  let brand = null;
  for (const b of brands) {
    if (normalized.includes(b)) {
      brand = b;
      break;
    }
  }
  
  // Mots-clés significatifs
  const stopWords = ['le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'ou', 'en', 'avec', 'pour', 'sur', 'par', 'dans', 'ce', 'cette', 'très', 'bon', 'état', 'etat', 'comme', 'neuf', 'occasion', 'vends', 'vend', 'urgent'];
  const words = normalized.split(/\s+/).filter(w => w.length > 2 && !stopWords.includes(w));
  
  // Construire la requête
  let searchQuery = '';
  if (modelMatch) {
    searchQuery = modelMatch;
    if (brand && !modelMatch.includes(brand)) {
      searchQuery = `${brand} ${searchQuery}`;
    }
  } else {
    searchQuery = words.slice(0, 5).join(' ');
  }

  return {
    model: modelMatch,
    brand: brand,
    keywords: words.slice(0, 10),
    numbers: numbers,
    searchQuery: searchQuery.trim()
  };
}

// ============================================
// CALCUL DU SCORE DE PERTINENCE
// ============================================

function calculateRelevanceScore(result, searchKeywords) {
  if (!result || !result.title) return 0;
  
  const resultTitle = result.title.toLowerCase();
  let score = 0;
  let maxScore = 0;
  
  // Mots exclusifs (indiquent un produit différent)
  const exclusiveWords = ['lot de', 'pack de', 'boîtier', 'boitier', 'alimentation', 'câble', 'cable', 'housse', 'coque', 'protection', 'chargeur', 'adaptateur', 'support', 'pièce', 'piece', 'réparation', 'reparation', 'hs', 'pour pièces', 'ne fonctionne pas', 'défectueux', 'defectueux'];
  
  for (const word of exclusiveWords) {
    if (resultTitle.includes(word)) {
      return -1; // Exclure
    }
  }
  
  // Score basé sur le modèle
  if (searchKeywords.model) {
    maxScore += 50;
    const modelNormalized = searchKeywords.model.toLowerCase().replace(/\s+/g, '');
    const resultNormalized = resultTitle.replace(/\s+/g, '');
    
    if (resultNormalized.includes(modelNormalized)) {
      score += 50;
    } else if (resultTitle.includes(searchKeywords.model.toLowerCase())) {
      score += 50;
    }
  }
  
  // Score basé sur les nombres
  if (searchKeywords.numbers.length > 0) {
    maxScore += 30;
    let numbersFound = 0;
    for (const num of searchKeywords.numbers) {
      if (resultTitle.includes(num)) {
        numbersFound++;
      }
    }
    score += (numbersFound / searchKeywords.numbers.length) * 30;
  }
  
  // Score basé sur la marque
  if (searchKeywords.brand) {
    maxScore += 10;
    if (resultTitle.includes(searchKeywords.brand)) {
      score += 10;
    }
  }
  
  // Score basé sur les mots-clés
  if (searchKeywords.keywords.length > 0) {
    maxScore += 10;
    let keywordsFound = 0;
    for (const kw of searchKeywords.keywords.slice(0, 5)) {
      if (resultTitle.includes(kw)) {
        keywordsFound++;
      }
    }
    score += (keywordsFound / Math.min(5, searchKeywords.keywords.length)) * 10;
  }
  
  return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
}

// ============================================
// FILTRAGE DES RÉSULTATS
// ============================================

function filterRelevantResults(results, searchKeywords, minScore = 30) {
  if (!results || results.length === 0) return [];
  
  const scored = results.map(result => ({
    ...result,
    relevanceScore: calculateRelevanceScore(result, searchKeywords)
  }));
  
  const filtered = scored.filter(r => r.relevanceScore >= minScore);
  const excluded = scored.filter(r => r.relevanceScore === -1).length;
  const lowScore = scored.filter(r => r.relevanceScore >= 0 && r.relevanceScore < minScore).length;
  
  filtered.sort((a, b) => b.relevanceScore - a.relevanceScore);
  
  console.log(`[ResellScout] Filtrage: ${results.length} → ${filtered.length} (${excluded} exclus, ${lowScore} score bas)`);
  
  return filtered;
}

// ============================================
// AGRÉGATION DES PRIX
// ============================================

async function fetchAllPrices(productData) {
  const { title, brand, category } = productData;
  
  const searchKeywords = extractKeywords(title);
  console.log('[ResellScout] Mots-clés extraits:', searchKeywords);
  
  let searchQuery = searchKeywords.searchQuery || searchKeywords.model || title || '';
  
  if (searchKeywords.brand && !searchQuery.toLowerCase().includes(searchKeywords.brand)) {
    searchQuery = `${searchKeywords.brand} ${searchQuery}`;
  }
  
  searchQuery = searchQuery
    .replace(/\d+[,.]?\d*\s*€/g, '')
    .replace(/[^\w\s\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 60);

  console.log(`[ResellScout] Recherche: "${searchQuery}"`);

  // Lancer les 3 recherches en parallèle
  const [vintedResults, leboncoinResults, ebayResults] = await Promise.allSettled([
    searchVintedPrices(searchQuery),
    searchLeBonCoinPrices(searchQuery),
    searchEbayPrices(searchQuery)
  ]);

  const occasionSources = [];
  let filteredVinted = [];
  let filteredLeboncoin = [];
  let filteredEbay = [];

  // Traiter Vinted
  if (vintedResults.status === 'fulfilled' && vintedResults.value.success) {
    filteredVinted = filterRelevantResults(vintedResults.value.prices, searchKeywords);
    if (filteredVinted.length > 0) {
      const priceValues = filteredVinted.map(p => p.price);
      occasionSources.push({
        ...vintedResults.value,
        prices: filteredVinted,
        count: filteredVinted.length,
        minPrice: Math.min(...priceValues),
        maxPrice: Math.max(...priceValues),
        avgPrice: Math.round(priceValues.reduce((a, b) => a + b, 0) / priceValues.length)
      });
    }
  }
  console.log('[ResellScout] Vinted:', vintedResults.status, vintedResults.value?.count || 0, 'brut,', filteredVinted.length, 'filtré');

  // Traiter LeBonCoin
  if (leboncoinResults.status === 'fulfilled' && leboncoinResults.value.success) {
    filteredLeboncoin = filterRelevantResults(leboncoinResults.value.prices, searchKeywords);
    if (filteredLeboncoin.length > 0) {
      const priceValues = filteredLeboncoin.map(p => p.price);
      occasionSources.push({
        ...leboncoinResults.value,
        prices: filteredLeboncoin,
        count: filteredLeboncoin.length,
        minPrice: Math.min(...priceValues),
        maxPrice: Math.max(...priceValues),
        avgPrice: Math.round(priceValues.reduce((a, b) => a + b, 0) / priceValues.length)
      });
    }
  }
  console.log('[ResellScout] LeBonCoin:', leboncoinResults.status, leboncoinResults.value?.count || 0, 'brut,', filteredLeboncoin.length, 'filtré');

  // Traiter eBay
  if (ebayResults.status === 'fulfilled' && ebayResults.value.success) {
    filteredEbay = filterRelevantResults(ebayResults.value.prices, searchKeywords);
    if (filteredEbay.length > 0) {
      const priceValues = filteredEbay.map(p => p.price);
      occasionSources.push({
        ...ebayResults.value,
        prices: filteredEbay,
        count: filteredEbay.length,
        minPrice: Math.min(...priceValues),
        maxPrice: Math.max(...priceValues),
        avgPrice: Math.round(priceValues.reduce((a, b) => a + b, 0) / priceValues.length)
      });
    }
  }
  console.log('[ResellScout] eBay:', ebayResults.status, ebayResults.value?.count || 0, 'brut,', filteredEbay.length, 'filtré');

  const allOccasionPrices = occasionSources.flatMap(s => s.prices.map(p => p.price));

  const result = {
    query: searchQuery,
    searchKeywords: searchKeywords,
    timestamp: Date.now(),
    
    occasionPrice: {
      available: allOccasionPrices.length > 0,
      avg: allOccasionPrices.length > 0 ? Math.round(allOccasionPrices.reduce((a, b) => a + b, 0) / allOccasionPrices.length) : null,
      min: allOccasionPrices.length > 0 ? Math.min(...allOccasionPrices) : null,
      max: allOccasionPrices.length > 0 ? Math.max(...allOccasionPrices) : null,
      count: allOccasionPrices.length,
      sources: occasionSources.map(s => ({
        name: s.source,
        avg: s.avgPrice,
        min: s.minPrice,
        max: s.maxPrice,
        count: s.count
      }))
    },

    rawResults: {
      vinted: {
        ...(vintedResults.status === 'fulfilled' ? vintedResults.value : { error: String(vintedResults.reason) }),
        prices: filteredVinted,
        originalCount: vintedResults.status === 'fulfilled' ? vintedResults.value.count : 0,
        filteredCount: filteredVinted.length
      },
      leboncoin: {
        ...(leboncoinResults.status === 'fulfilled' ? leboncoinResults.value : { error: String(leboncoinResults.reason) }),
        prices: filteredLeboncoin,
        originalCount: leboncoinResults.status === 'fulfilled' ? leboncoinResults.value.count : 0,
        filteredCount: filteredLeboncoin.length
      },
      ebay: {
        ...(ebayResults.status === 'fulfilled' ? ebayResults.value : { error: String(ebayResults.reason) }),
        prices: filteredEbay,
        originalCount: ebayResults.status === 'fulfilled' ? ebayResults.value.count : 0,
        filteredCount: filteredEbay.length
      }
    }
  };

  console.log('[ResellScout] Total:', result.occasionPrice.count, 'prix de', occasionSources.length, 'sources');

  return result;
}

// ============================================
// CALCUL DE RENTABILITÉ
// ============================================

function calculateProfitability(currentPrice, priceData) {
  const result = {
    currentPrice: currentPrice,
    
    vsOccasion: {
      available: priceData.occasionPrice.available,
      avgMarketPrice: priceData.occasionPrice.avg,
      difference: null,
      percentDiff: null,
      verdict: null
    },
    
    dealScore: null,
    dealRating: null,
    recommendation: null
  };

  if (priceData.occasionPrice.available && priceData.occasionPrice.avg) {
    result.vsOccasion.difference = priceData.occasionPrice.avg - currentPrice;
    result.vsOccasion.percentDiff = Math.round((result.vsOccasion.difference / priceData.occasionPrice.avg) * 100);
    
    if (result.vsOccasion.percentDiff >= 20) {
      result.vsOccasion.verdict = 'EXCELLENT - Bien en dessous du marché';
    } else if (result.vsOccasion.percentDiff >= 10) {
      result.vsOccasion.verdict = 'BON - En dessous du marché';
    } else if (result.vsOccasion.percentDiff >= 0) {
      result.vsOccasion.verdict = 'CORRECT - Dans la moyenne';
    } else if (result.vsOccasion.percentDiff >= -10) {
      result.vsOccasion.verdict = 'ÉLEVÉ - Au dessus du marché';
    } else {
      result.vsOccasion.verdict = 'TROP CHER - Bien au dessus du marché';
    }
  }

  let score = 50;
  if (result.vsOccasion.available) {
    score += result.vsOccasion.percentDiff * 2;
  }
  score = Math.max(0, Math.min(100, score));
  result.dealScore = Math.round(score);

  if (!result.vsOccasion.available) {
    result.dealRating = 'DONNÉES INSUFFISANTES';
    result.recommendation = 'Pas assez de données pour évaluer';
  } else if (score >= 80) {
    result.dealRating = 'AFFAIRE EXCEPTIONNELLE';
    result.recommendation = 'Acheter immédiatement!';
  } else if (score >= 65) {
    result.dealRating = 'BONNE AFFAIRE';
    result.recommendation = 'Prix intéressant, à saisir';
  } else if (score >= 50) {
    result.dealRating = 'PRIX CORRECT';
    result.recommendation = 'Prix dans la moyenne du marché';
  } else if (score >= 35) {
    result.dealRating = 'PRIX ÉLEVÉ';
    result.recommendation = 'Négocier ou chercher ailleurs';
  } else {
    result.dealRating = 'TROP CHER';
    result.recommendation = 'Éviter, prix bien au dessus du marché';
  }

  return result;
}

// ============================================
// TRANSFORMATION POUR L'OVERLAY
// ============================================

function transformAnalysisForOverlay(analysis) {
  const { product, prices, profitability } = analysis;
  
  // Sources avec détails
  const sources = [];
  
  if (prices.rawResults?.vinted) {
    sources.push({
      name: 'Vinted',
      count: prices.rawResults.vinted.filteredCount || 0,
      avgPrice: prices.rawResults.vinted.avgPrice,
      minPrice: prices.rawResults.vinted.minPrice,
      maxPrice: prices.rawResults.vinted.maxPrice,
      items: prices.rawResults.vinted.prices || [],
      error: prices.rawResults.vinted.error
    });
  }
  
  if (prices.rawResults?.leboncoin) {
    sources.push({
      name: 'LeBonCoin',
      count: prices.rawResults.leboncoin.filteredCount || 0,
      avgPrice: prices.rawResults.leboncoin.avgPrice,
      minPrice: prices.rawResults.leboncoin.minPrice,
      maxPrice: prices.rawResults.leboncoin.maxPrice,
      items: prices.rawResults.leboncoin.prices || [],
      error: prices.rawResults.leboncoin.error
    });
  }
  
  if (prices.rawResults?.ebay) {
    sources.push({
      name: 'eBay',
      count: prices.rawResults.ebay.filteredCount || 0,
      avgPrice: prices.rawResults.ebay.avgPrice,
      minPrice: prices.rawResults.ebay.minPrice,
      maxPrice: prices.rawResults.ebay.maxPrice,
      items: prices.rawResults.ebay.prices || [],
      error: prices.rawResults.ebay.error
    });
  }

  return {
    product: {
      title: product.title,
      price: product.price,
      platform: product.platform,
      image: product.image,
      url: product.url
    },
    
    searchQuery: prices.query,
    
    market: {
      avgPrice: prices.occasionPrice.avg,
      minPrice: prices.occasionPrice.min,
      maxPrice: prices.occasionPrice.max,
      totalListings: prices.occasionPrice.count,
      sources: sources
    },
    
    analysis: {
      dealScore: profitability.dealScore,
      dealRating: profitability.dealRating,
      recommendation: profitability.recommendation,
      priceDifference: profitability.vsOccasion.difference,
      percentDiff: profitability.vsOccasion.percentDiff,
      verdict: profitability.vsOccasion.verdict
    },
    
    timestamp: prices.timestamp
  };
}

// ============================================
// MESSAGE HANDLERS
// ============================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[ResellScout] Message reçu:', request.action);
  
  // Handler principal pour l'analyse d'item (depuis content script)
  if (request.action === 'analyzeItem') {
    const productData = {
      title: request.itemData?.title || request.itemData?.name || '',
      price: request.itemData?.price || 0,
      platform: request.itemData?.platform || 'unknown',
      image: request.itemData?.image || request.itemData?.images?.[0] || null,
      url: request.itemData?.url || sender.tab?.url || ''
    };
    
    const customQuery = request.itemData?.customQuery || null;
    
    handleAnalyzeProduct(productData, customQuery)
      .then(result => {
        console.log('[ResellScout] Analyse terminée, envoi réponse');
        sendResponse({ success: true, analysis: result });
      })
      .catch(error => {
        console.error('[ResellScout] Erreur analyse:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Indique qu'on va répondre de manière asynchrone
  }
  
  // Handler alternatif (pour compatibilité)
  if (request.action === 'analyzeProduct') {
    handleAnalyzeProduct(request.data, request.customQuery)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => {
        console.error('[ResellScout] Erreur analyse:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (request.action === 'searchPrices') {
    fetchAllPrices({ title: request.query })
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  // Handler pour ping (vérifier que le service worker est actif)
  if (request.action === 'ping') {
    sendResponse({ success: true, message: 'pong' });
    return false;
  }
  
  return false;
});

async function handleAnalyzeProduct(productData, customQuery = null) {
  console.log('[ResellScout] Analyse produit:', productData.title);
  
  const searchData = customQuery ? { ...productData, title: customQuery } : productData;
  
  const prices = await fetchAllPrices(searchData);
  const profitability = calculateProfitability(productData.price, prices);
  
  const analysis = {
    product: productData,
    prices: prices,
    profitability: profitability
  };
  
  return transformAnalysisForOverlay(analysis);
}

console.log('[ResellScout] Service Worker v6.0 chargé - Sources: Vinted, LeBonCoin, eBay');
