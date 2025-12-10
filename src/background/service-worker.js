/**
 * ResellScout - Service Worker v4.1
 * 100% Prix Réels - Sources: Vinted et LeBonCoin uniquement
 */

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  REQUEST_DELAY: 500,
  TIMEOUT: 15000,
  MAX_RESULTS: 30
};

// ============================================
// RECHERCHE PRIX - VINTED API
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

    // URLs à essayer dans l'ordre
    const searchUrls = [
      `https://www.vinted.fr/api/v2/catalog/items?search_text=${encodeURIComponent(cleanQuery)}&order=relevance&per_page=${CONFIG.MAX_RESULTS}`,
      `https://www.vinted.fr/api/v2/items?search_text=${encodeURIComponent(cleanQuery)}&per_page=${CONFIG.MAX_RESULTS}`
    ];

    let data = null;
    let lastError = null;

    // Essayer chaque URL jusqu'à ce qu'une fonctionne
    for (const searchUrl of searchUrls) {
      try {
        console.log('[ResellScout] Essai URL:', searchUrl.substring(0, 60) + '...');
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT);

        // Méthode 1: Avec credentials (si cookies disponibles)
        let response;
        try {
          response = await fetch(searchUrl, {
            method: 'GET',
            headers: {
              'Accept': 'application/json, text/plain, */*',
              'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            },
            credentials: 'include',
            signal: controller.signal
          });
        } catch (fetchError) {
          console.log('[ResellScout] Fetch avec credentials échoué, essai sans...');
          // Méthode 2: Sans credentials
          response = await fetch(searchUrl, {
            method: 'GET',
            headers: {
              'Accept': 'application/json, text/plain, */*',
              'Accept-Language': 'fr-FR,fr;q=0.9'
            },
            signal: controller.signal
          });
        }

        clearTimeout(timeoutId);

        if (response.ok) {
          data = await response.json();
          console.log('[ResellScout] Vinted réponse OK:', data);
          break; // Sortir de la boucle si succès
        } else {
          lastError = `HTTP ${response.status}`;
          console.log('[ResellScout] Vinted erreur HTTP:', response.status);
        }
      } catch (e) {
        lastError = e.message;
        console.log('[ResellScout] Erreur Vinted URL:', e.message);
      }
    }

    // Traitement des résultats
    if (data) {
      const items = data.items || data.data || [];
      
      if (items.length > 0) {
        results.prices = items
          .filter(item => item.price || item.total_item_price || item.price_numeric)
          .map(item => {
            const price = parseFloat(item.price || item.total_item_price || item.price_numeric || 0);
            return {
              price: price,
              title: item.title || 'Article Vinted',
              url: item.url || `https://www.vinted.fr/items/${item.id}`,
              condition: item.status || item.condition,
              brand: item.brand_title || item.brand?.title,
              size: item.size_title || item.size,
              image: item.photo?.url || item.photos?.[0]?.url || item.thumbnail?.url || null
            };
          })
          .filter(item => item.price > 0);

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
    }

    if (!results.success && lastError) {
      results.error = lastError;
    }

  } catch (error) {
    results.error = error.message;
    console.warn('[ResellScout] Erreur Vinted globale:', error.message);
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

    if (options.categoryId) {
      requestBody.filters.category.id = options.categoryId;
    }

    console.log('[ResellScout] Recherche LeBonCoin:', cleanQuery);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT);

    const response = await fetch('https://api.leboncoin.fr/finder/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': 'https://www.leboncoin.fr',
        'Referer': 'https://www.leboncoin.fr/'
      },
      body: JSON.stringify(requestBody),
      credentials: 'include',
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`LeBonCoin API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.ads && data.ads.length > 0) {
      results.prices = data.ads
        .filter(ad => ad.price && ad.price[0])
        .map(ad => ({
          price: parseFloat(ad.price[0]),
          title: ad.subject,
          url: ad.url,
          location: ad.location?.city,
          date: ad.first_publication_date,
          photo: ad.images?.urls?.[0],
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
      }
    }

    console.log('[ResellScout] LeBonCoin résultats:', results.count, 'annonces trouvées');

  } catch (error) {
    results.error = error.message;
    console.warn('[ResellScout] Erreur LeBonCoin:', error.message);
  }

  return results;
}

// ============================================
// EXTRACTION DES MOTS-CLÉS IMPORTANTS
// ============================================

function extractKeywords(title) {
  if (!title) return { model: null, brand: null, keywords: [], numbers: [], searchQuery: null };
  
  // Normaliser le titre
  let normalized = title.toLowerCase().trim();
  
  // Normaliser les variantes de CPU Intel: "Core I7 9700 KF" -> "i7 9700kf"
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
  
  // Patterns pour les numéros de modèle
  const modelPatterns = [
    /\b(rtx|gtx)\s*(\d{3,4})\s*(ti|super)?\b/gi,
    /\b(rx)\s*(\d{3,4})\s*(xt|xtx)?\b/gi,
    /\b(radeon|geforce)\s*(rtx|gtx|rx)?\s*(\d{3,4})\s*(ti|super|xt)?\b/gi,
    /\b(i[3579])\s*[-]?\s*(\d{4,5})([kfx]*)\b/gi,
    /\b(ryzen\s*[3579])\s*(\d{4}[a-z]*)\b/gi,
    /\b(r[3579])\s*(\d{4}[a-z]*)\b/gi,
    /\b(iphone|ipad)\s*(\d{1,2})\s*(pro|max|plus|mini)?\b/gi,
    /\b(galaxy)\s*(s|a|z|note)?\s*(\d{1,2})\s*(ultra|plus|fe)?\b/gi,
    /\b(pixel)\s*(\d{1,2})\s*(pro|a)?\b/gi,
    /\b(ps[45]|playstation\s*[45])\s*(pro|slim)?\b/gi,
    /\b(xbox)\s*(series\s*[xs]|one|one\s*[xs])?\b/gi,
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
  
  // Si pas de match, essayer de construire un modèle CPU
  if (!modelMatch) {
    const cpuMatch = normalized.match(/i([3579])\s*[-]?\s*(\d{4,5})([kfx]*)/i);
    if (cpuMatch) {
      modelMatch = `i${cpuMatch[1]} ${cpuMatch[2]}${cpuMatch[3] || ''}`.trim();
    }
  }
  
  // Extraire les nombres significatifs
  const numbers = [];
  const numberMatches = normalized.match(/\b\d{4,5}[a-z]*\b/gi) || [];
  numberMatches.forEach(n => {
    if (!numbers.includes(n.toLowerCase())) {
      numbers.push(n.toLowerCase());
    }
  });
  
  // Marques connues
  const knownBrands = [
    'nvidia', 'amd', 'intel', 'asus', 'msi', 'gigabyte', 'evga', 'zotac', 'sapphire', 'powercolor',
    'apple', 'samsung', 'sony', 'microsoft', 'nintendo', 'logitech', 'razer', 'corsair', 'steelseries',
    'hp', 'dell', 'lenovo', 'acer', 'lg', 'benq', 'aoc', 'viewsonic',
    'seagate', 'western digital', 'wd', 'crucial', 'kingston', 'sandisk'
  ];
  
  let brand = null;
  if (/\bi[3579]\b/i.test(normalized)) {
    brand = 'intel';
  } else {
    for (const b of knownBrands) {
      if (normalized.includes(b)) {
        brand = b;
        break;
      }
    }
  }
  
  // Détecter le type de produit
  let productType = 'other';
  if (/\b(rtx|gtx|rx|radeon|geforce)\s*\d{3,4}/i.test(normalized)) {
    productType = 'gpu';
  } else if (/\bi[3579]\s*[-]?\s*\d{4,5}/i.test(normalized) || /\b(ryzen|r[3579])\s*\d{4}/i.test(normalized)) {
    productType = 'cpu';
  } else if (/\biphone|ipad|galaxy|pixel\b/i.test(normalized)) {
    productType = 'phone';
  } else if (/\bps[45]|playstation|xbox|switch\b/i.test(normalized)) {
    productType = 'console';
  } else if (/\bécran|moniteur|monitor\b/i.test(normalized)) {
    productType = 'monitor';
  }
  
  // Mots-clés importants
  const stopWords = ['le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'ou', 'the', 'a', 'an', 
                      'for', 'with', 'très', 'bon', 'état', 'neuf', 'occasion', 'comme', 'parfait',
                      'excellent', 'good', 'great', 'new', 'used', 'etat', 'tbe', 'ttbe', 'lga',
                      'socket', 'processeur', 'processor', 'core'];
  
  const words = normalized
    .replace(/[^\w\s\-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.includes(w));
  
  // Construire une requête de recherche optimisée
  let searchQuery = modelMatch || '';
  if (!searchQuery && numbers.length > 0) {
    const mainNumber = numbers.find(n => n.length >= 4) || numbers[0];
    if (productType === 'cpu' && /\bi[3579]/i.test(normalized)) {
      const iMatch = normalized.match(/i([3579])/i);
      if (iMatch) {
        searchQuery = `i${iMatch[1]} ${mainNumber}`;
      }
    }
  }
  
  console.log('[ResellScout] Modèle extrait:', modelMatch, '| Query:', searchQuery);
  
  return {
    model: modelMatch,
    brand: brand,
    productType: productType,
    keywords: words,
    numbers: numbers,
    original: title,
    searchQuery: searchQuery
  };
}

// ============================================
// CALCUL DU SCORE DE PERTINENCE
// ============================================

function calculateRelevanceScore(result, searchKeywords) {
  const resultTitle = (result.title || '').toLowerCase();
  let score = 0;
  let maxScore = 0;
  
  // EXCLUSIONS GÉNÉRALES
  const alwaysExclude = [
    'lot de', 'pack de', 'bundle', 'kit complet',
    'tout inclus', 'prêt à jouer', 'pret a jouer',
    'recherche', 'cherche', 'échange', 'echange', 'troc',
    'achat', 'achète', 'achete'
  ];
  
  for (const exclusion of alwaysExclude) {
    if (resultTitle.includes(exclusion)) {
      return -1;
    }
  }
  
  // EXCLUSIONS SPÉCIFIQUES AU TYPE DE PRODUIT
  const productType = searchKeywords.productType;
  
  if (productType === 'gpu') {
    const gpuExclusions = [
      'pc gamer', 'pc gaming', 'pc complet', 'pc fixe', 'ordinateur',
      'tour complète', 'tour complete', 'config', 'configuration',
      'setup complet', 'setup gaming', 'desktop',
      'unité centrale', 'unite centrale',
      'laptop', 'portable', 'notebook', 'ultrabook', 'macbook'
    ];
    
    for (const exclusion of gpuExclusions) {
      if (resultTitle.includes(exclusion)) {
        return -1;
      }
    }
    
    if (/\b(i[3579]|ryzen\s*[3579]|r[3579]|core)[-\s]*\d{4,5}\b/i.test(resultTitle)) {
      return -1;
    }
    if (/\b\d+\s*go?\s*(de\s*)?(ram|ddr)/i.test(resultTitle)) {
      return -1;
    }
    if (/\b\d+\s*(to|tb|go|gb)\s*(ssd|hdd|nvme)/i.test(resultTitle)) {
      return -1;
    }
  }
  
  if (productType === 'cpu') {
    const cpuExclusions = [
      'pc gamer', 'pc gaming', 'pc complet', 'pc fixe', 'ordinateur',
      'tour complète', 'tour complete', 'config complète', 'configuration',
      'setup complet', 'desktop complet', 'pc de bureau', 'pc bureau',
      'laptop', 'portable', 'notebook',
      'unité centrale', 'unite centrale'
    ];
    
    for (const exclusion of cpuExclusions) {
      if (resultTitle.includes(exclusion)) {
        return -1;
      }
    }
    
    // Exclure si pattern "pc " au début ou " pc " au milieu
    if (/^pc\s/i.test(resultTitle) || /\spc\s/i.test(resultTitle)) {
      return -1;
    }
    
    if (/\b(rtx|gtx|rx|radeon|geforce)\s*\d{3,4}/i.test(resultTitle)) {
      return -1;
    }
    if (/\b\d+\s*go?\s*(de\s*)?(ram|ddr)/i.test(resultTitle)) {
      return -1;
    }
    if (/\b\d+\s*(to|tb|go|gb)\s*(ssd|hdd|nvme)/i.test(resultTitle)) {
      return -1;
    }
    if (/\+.*\+/i.test(resultTitle)) {
      return -1;
    }
    if (/carte\s*m[eè]re|motherboard|mobo/i.test(resultTitle)) {
      return -1;
    }
  }
  
  if (productType === 'phone') {
    const phoneExclusions = [
      'coque', 'etui', 'protection', 'chargeur seul', 'câble',
      'pièces', 'pieces', 'pour pièces', 'hs', 'bloqué', 'bloque',
      'ecran seul', 'écran seul', 'batterie seule',
    ];
    
    for (const exclusion of phoneExclusions) {
      if (resultTitle.includes(exclusion)) {
        return -1;
      }
    }
  }
  
  if (productType === 'console') {
    const consoleExclusions = [
      'jeu ', 'jeux ', 'manette seule', 'controller',
      'pour pièces', 'hs', 'en panne',
    ];
    
    for (const exclusion of consoleExclusions) {
      if (resultTitle.includes(exclusion)) {
        return -1;
      }
    }
  }
  
  // CALCUL DU SCORE
  if (searchKeywords.model) {
    maxScore += 50;
    const modelNormalized = searchKeywords.model.replace(/\s+/g, '').toLowerCase();
    const resultNormalized = resultTitle.replace(/\s+/g, '');
    
    if (resultNormalized.includes(modelNormalized)) {
      score += 50;
    } else if (resultTitle.includes(searchKeywords.model.toLowerCase())) {
      score += 50;
    }
  }
  
  if (searchKeywords.numbers.length > 0) {
    maxScore += 30;
    let numbersFound = 0;
    for (const num of searchKeywords.numbers) {
      const numPattern = new RegExp(`\\b${num}\\b`, 'i');
      if (numPattern.test(resultTitle)) {
        numbersFound++;
      }
    }
    score += (numbersFound / searchKeywords.numbers.length) * 30;
  }
  
  if (searchKeywords.brand) {
    maxScore += 10;
    if (resultTitle.includes(searchKeywords.brand)) {
      score += 10;
    }
  }
  
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

function filterRelevantResults(results, searchKeywords, minScore = 40) {
  if (!results || results.length === 0) return [];
  
  const scored = results.map(result => ({
    ...result,
    relevanceScore: calculateRelevanceScore(result, searchKeywords)
  }));
  
  const filtered = scored.filter(r => r.relevanceScore >= minScore);
  const excluded = scored.filter(r => r.relevanceScore === -1).length;
  const lowScore = scored.filter(r => r.relevanceScore >= 0 && r.relevanceScore < minScore).length;
  
  filtered.sort((a, b) => b.relevanceScore - a.relevanceScore);
  
  console.log(`[ResellScout] Filtrage: ${results.length} résultats → ${filtered.length} gardés (${excluded} exclus, ${lowScore} score trop bas)`);
  
  return filtered;
}

// ============================================
// AGRÉGATION DES PRIX
// ============================================

async function fetchAllPrices(productData) {
  const { title, brand, category } = productData;
  
  const searchKeywords = extractKeywords(title);
  console.log('[ResellScout] Mots-clés extraits:', searchKeywords);
  
  // Construire la requête de recherche optimisée
  let searchQuery = '';
  
  if (searchKeywords.searchQuery) {
    searchQuery = searchKeywords.searchQuery;
  } else if (searchKeywords.model) {
    searchQuery = searchKeywords.model;
  } else {
    searchQuery = title || '';
  }
  
  if (searchKeywords.brand && !searchQuery.toLowerCase().includes(searchKeywords.brand)) {
    searchQuery = `${searchKeywords.brand} ${searchQuery}`;
  }
  
  searchQuery = searchQuery
    .replace(/\d+[,.]?\d*\s*€/g, '')
    .replace(/[^\w\s\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 60);

  console.log(`[ResellScout] Recherche de prix pour: "${searchQuery}"`);

  // Lancer les recherches en parallèle - SEULEMENT OCCASION
  const [vintedResults, leboncoinResults] = await Promise.allSettled([
    searchVintedPrices(searchQuery),
    searchLeBonCoinPrices(searchQuery)
  ]);

  const occasionSources = [];
  let filteredVinted = [];
  let filteredLeboncoin = [];

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
      }
    }
  };

  console.log('[ResellScout] Résultats agrégés:', result.occasionPrice.count, 'prix occasion');

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
  
  let rating = 'fair';
  let emoji = '⚡';
  let ratingLabel = 'Prix correct';
  
  if (!profitability.vsOccasion.available) {
    rating = 'loading';
    emoji = '❓';
    ratingLabel = 'Données insuffisantes';
  } else if (profitability.dealScore >= 80) {
    rating = 'excellent';
    emoji = '🔥';
    ratingLabel = 'Affaire exceptionnelle';
  } else if (profitability.dealScore >= 65) {
    rating = 'good';
    emoji = '✅';
    ratingLabel = 'Bonne affaire';
  } else if (profitability.dealScore >= 50) {
    rating = 'fair';
    emoji = '⚡';
    ratingLabel = 'Prix correct';
  } else if (profitability.dealScore >= 35) {
    rating = 'overpriced';
    emoji = '⚠️';
    ratingLabel = 'Prix élevé';
  } else {
    rating = 'overpriced';
    emoji = '❌';
    ratingLabel = 'Trop cher';
  }

  const profit = profitability.vsOccasion.difference || 0;
  const discount = profitability.vsOccasion.percentDiff || 0;

  let confidence = 'none';
  const occasionCount = prices.occasionPrice.count || 0;
  const sourcesCount = prices.occasionPrice.sources?.length || 0;
  
  if (occasionCount >= 15 && sourcesCount >= 2) {
    confidence = 'high';
  } else if (occasionCount >= 5 || sourcesCount >= 1) {
    confidence = 'medium';
  } else if (occasionCount > 0) {
    confidence = 'low';
  }

  const sourcesUsed = prices.occasionPrice.sources?.map(s => s.name) || [];

  const usedListings = [];
  
  if (prices.rawResults) {
    if (prices.rawResults.vinted && prices.rawResults.vinted.prices) {
      prices.rawResults.vinted.prices.forEach(item => {
        usedListings.push({
          ...item,
          platform: 'Vinted',
          source: 'vinted'
        });
      });
    }
    
    if (prices.rawResults.leboncoin && prices.rawResults.leboncoin.prices) {
      prices.rawResults.leboncoin.prices.forEach(item => {
        usedListings.push({
          ...item,
          platform: 'LeBonCoin',
          source: 'leboncoin'
        });
      });
    }
  }

  usedListings.sort((a, b) => a.price - b.price);

  return {
    currentPrice: product.price,
    averageUsedPrice: prices.occasionPrice.available ? prices.occasionPrice.avg : null,
    
    profit: profit,
    discount: discount,
    
    rating: rating,
    emoji: emoji,
    ratingLabel: ratingLabel,
    dealScore: profitability.dealScore,
    
    source: sourcesUsed.length > 0 ? sourcesUsed[0] : 'Aucune source',
    sourcesUsed: sourcesUsed,
    dataPoints: occasionCount,
    confidence: confidence,
    
    priceRange: {
      min: prices.occasionPrice.min,
      max: prices.occasionPrice.max
    },
    
    brandInfo: product.brand ? { brand: product.brand } : null,
    recommendation: profitability.recommendation,
    
    oldPrice: product.oldPrice || null,
    priceDrop: product.priceDrop || null,
    hasPriceDrop: product.hasPriceDrop || false,
    listingAge: product.listingAge || null,
    originalDate: product.originalDate || null,

    usedSources: usedListings,
    newSources: [],
    
    // Requête de recherche utilisée (pour permettre la modification)
    searchQuery: prices.query || null
  };
}

// ============================================
// ANALYSE COMPLÈTE
// ============================================

async function handleAnalyzeProduct(productData) {
  console.log('[ResellScout] Analyse du produit:', productData);

  if (!productData || (!productData.title && !productData.price)) {
    console.error('[ResellScout] Données produit invalides');
    return {
      product: productData,
      prices: { occasionPrice: { available: false } },
      profitability: { dealScore: 50, vsOccasion: { available: false } },
      error: 'Données produit insuffisantes'
    };
  }

  const priceData = await fetchAllPrices(productData);
  const profitability = calculateProfitability(productData.price || 0, priceData);

  const analysis = {
    product: productData,
    prices: priceData,
    profitability: profitability,
    timestamp: Date.now(),
    
    summary: {
      currentPrice: productData.price,
      marketPrice: priceData.occasionPrice.avg,
      dealScore: profitability.dealScore,
      dealRating: profitability.dealRating,
      recommendation: profitability.recommendation,
      sources: {
        occasion: priceData.occasionPrice.sources?.map(s => s.name) || []
      }
    }
  };

  try {
    await saveToHistory(analysis);
  } catch (e) {
    console.warn('[ResellScout] Erreur sauvegarde historique:', e);
  }

  return analysis;
}

// ============================================
// GESTION DES MESSAGES
// ============================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[ResellScout] Message reçu:', message.type || message.action);

  if (message.action === 'analyzeItem') {
    handleAnalyzeProduct(message.itemData)
      .then(analysis => {
        const result = transformAnalysisForOverlay(analysis);
        console.log('[ResellScout] Analyse terminée, envoi résultat');
        sendResponse({ success: true, analysis: result });
      })
      .catch(error => {
        console.error('[ResellScout] Erreur analyse:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (message.type === 'ANALYZE_PRODUCT') {
    handleAnalyzeProduct(message.data)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'GET_PRICE_DATA') {
    fetchAllPrices(message.data)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.action === 'getHistory' || message.type === 'GET_HISTORY') {
    getHistory()
      .then(history => sendResponse({ success: true, history: history, data: history }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.action === 'clearHistory') {
    chrome.storage.local.set({ history: [] })
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.action === 'getSettings') {
    chrome.storage.local.get('settings')
      .then(result => sendResponse({ success: true, settings: result.settings }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.action === 'saveSettings') {
    chrome.storage.local.set({ settings: message.settings })
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  console.warn('[ResellScout] Message non géré:', message);
  sendResponse({ success: false, error: 'Action non reconnue' });
  return false;
});

// ============================================
// HISTORIQUE
// ============================================

async function saveToHistory(analysis) {
  try {
    const result = await chrome.storage.local.get('history');
    const history = result.history || [];
    
    history.unshift({
      id: Date.now(),
      ...analysis,
      savedAt: new Date().toISOString()
    });

    if (history.length > 100) {
      history.splice(100);
    }

    await chrome.storage.local.set({ history });
    console.log('[ResellScout] Analyse sauvegardée');
  } catch (error) {
    console.error('[ResellScout] Erreur sauvegarde:', error);
  }
}

async function getHistory() {
  try {
    const result = await chrome.storage.local.get('history');
    return result.history || [];
  } catch (error) {
    console.error('[ResellScout] Erreur récupération historique:', error);
    return [];
  }
}

// ============================================
// INITIALISATION
// ============================================

chrome.runtime.onInstalled.addListener(() => {
  console.log('[ResellScout] Extension installée - v4.0');
  
  chrome.storage.local.set({
    settings: {
      enabled: true,
      autoAnalyze: true,
      showOverlay: true,
      sources: {
        vinted: true,
        leboncoin: true
      }
    }
  });
});

console.log('[ResellScout] Service Worker chargé - v4.0 (Vinted + LeBonCoin uniquement)');
