/**
 * ResellScout - Service Worker v7.0
 * 100% Prix Réels - Sources: Vinted, LeBonCoin et eBay
 */

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  REQUEST_DELAY: 300,
  TIMEOUT: 15000,
  MAX_RESULTS: 25
};

// ============================================
// RECHERCHE PRIX - VINTED
// ============================================

async function searchVintedPrices(query) {
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

    // Essayer l'API puis le scraping HTML
    let items = await tryVintedAPI(cleanQuery);
    
    if (items.length === 0) {
      console.log('[ResellScout] Vinted API vide, essai scraping...');
      items = await scrapeVintedPage(cleanQuery);
    }

    if (items.length > 0) {
      results.prices = items;
      const priceValues = items.map(p => p.price).filter(p => p > 0);
      
      if (priceValues.length > 0) {
        results.minPrice = Math.min(...priceValues);
        results.maxPrice = Math.max(...priceValues);
        results.avgPrice = Math.round(priceValues.reduce((a, b) => a + b, 0) / priceValues.length);
        results.count = priceValues.length;
        results.success = true;
        console.log('[ResellScout] Vinted succès:', results.count, 'articles');
      }
    } else {
      results.error = 'Aucun résultat Vinted';
    }

  } catch (error) {
    console.warn('[ResellScout] Erreur Vinted:', error.message);
    results.error = error.message;
  }

  return results;
}

async function tryVintedAPI(query) {
  const items = [];
  
  try {
    const searchUrl = `https://www.vinted.fr/api/v2/catalog/items?page=1&per_page=${CONFIG.MAX_RESULTS}&search_text=${encodeURIComponent(query)}&order=relevance`;
    
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'fr-FR,fr;q=0.9'
      }
    });

    console.log('[ResellScout] Vinted API status:', response.status);

    if (response.ok) {
      const data = await response.json();
      console.log('[ResellScout] Vinted API data:', data?.items?.length || 0, 'items');
      
      if (data.items && data.items.length > 0) {
        for (const item of data.items) {
          const price = parseFloat(item.price || item.total_item_price || 0);
          if (price > 0) {
            items.push({
              price: price,
              title: item.title || 'Article Vinted',
              url: item.url || `https://www.vinted.fr/items/${item.id}`,
              image: item.photo?.url || item.photos?.[0]?.url || null,
              platform: 'Vinted'
            });
          }
        }
      }
    }
  } catch (e) {
    console.log('[ResellScout] Vinted API error:', e.message);
  }
  
  return items;
}

async function scrapeVintedPage(query) {
  const items = [];
  
  try {
    const searchUrl = `https://www.vinted.fr/catalog?search_text=${encodeURIComponent(query)}&order=relevance`;
    console.log('[ResellScout] Scraping Vinted:', searchUrl);
    
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9'
      }
    });

    console.log('[ResellScout] Vinted HTML status:', response.status);

    if (!response.ok) {
      return items;
    }

    const html = await response.text();
    console.log('[ResellScout] Vinted HTML:', html.length, 'chars');

    // Chercher les données JSON dans __NEXT_DATA__
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
    if (nextDataMatch) {
      try {
        const jsonData = JSON.parse(nextDataMatch[1]);
        const catalogItems = jsonData?.props?.pageProps?.items || 
                           jsonData?.props?.pageProps?.catalog?.items || [];
        
        console.log('[ResellScout] Vinted NEXT_DATA items:', catalogItems.length);
        
        for (const item of catalogItems.slice(0, CONFIG.MAX_RESULTS)) {
          const price = parseFloat(item.price || item.total_item_price || 0);
          if (price > 0) {
            items.push({
              price: price,
              title: item.title || 'Article Vinted',
              url: `https://www.vinted.fr/items/${item.id}`,
              image: item.photo?.url || null,
              platform: 'Vinted'
            });
          }
        }
      } catch (e) {
        console.log('[ResellScout] Vinted JSON parse error:', e.message);
      }
    }

    // Si pas de JSON, extraire les prix du HTML
    if (items.length === 0) {
      const priceMatches = [...html.matchAll(/(\d+(?:[,\.]\d{2})?)\s*€/g)];
      const seenPrices = new Set();
      
      for (const match of priceMatches) {
        const price = parseFloat(match[1].replace(',', '.'));
        if (price >= 5 && price <= 5000 && !seenPrices.has(price)) {
          seenPrices.add(price);
          items.push({
            price: price,
            title: 'Article Vinted',
            url: searchUrl,
            image: null,
            platform: 'Vinted'
          });
          if (items.length >= CONFIG.MAX_RESULTS) break;
        }
      }
      console.log('[ResellScout] Vinted prix HTML:', items.length);
    }

  } catch (e) {
    console.warn('[ResellScout] Vinted scrape error:', e.message);
  }
  
  return items;
}

// ============================================
// RECHERCHE PRIX - EBAY
// ============================================

async function searchEbayPrices(query) {
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

    // eBay France - occasion seulement
    const searchUrl = `https://www.ebay.fr/sch/i.html?_nkw=${encodeURIComponent(cleanQuery)}&_sop=12&LH_ItemCondition=3000&_ipg=50`;
    
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9'
      }
    });

    console.log('[ResellScout] eBay status:', response.status);

    if (!response.ok) {
      throw new Error(`eBay HTTP ${response.status}`);
    }

    const html = await response.text();
    console.log('[ResellScout] eBay HTML:', html.length, 'chars');

    const items = [];
    const itemBlocks = html.split(/class="s-item\s+s-item/gi).slice(1);
    
    for (const block of itemBlocks.slice(0, CONFIG.MAX_RESULTS)) {
      try {
        const priceMatch = block.match(/class="s-item__price"[^>]*>\s*(\d+(?:[,\.]\d{2})?)\s*EUR/i);
        if (!priceMatch) continue;
        
        const price = parseFloat(priceMatch[1].replace(',', '.'));
        if (price <= 0 || isNaN(price)) continue;

        const titleMatch = block.match(/class="s-item__title"[^>]*>(?:<span[^>]*>)?([^<]+)/i);
        let title = titleMatch ? titleMatch[1].trim() : 'Article eBay';
        
        if (title.toLowerCase().includes('shop on ebay') || title.length < 3) continue;

        const linkMatch = block.match(/href="(https:\/\/www\.ebay\.fr\/itm\/[^"]+)"/i);
        const url = linkMatch ? linkMatch[1].split('?')[0] : 'https://www.ebay.fr';

        const imgMatch = block.match(/src="(https:\/\/i\.ebayimg\.com[^"]+)"/i);
        const image = imgMatch ? imgMatch[1] : null;

        items.push({ price, title, url, image, platform: 'eBay' });
      } catch (e) {}
    }

    // Fallback: extraire juste les prix
    if (items.length === 0) {
      const priceMatches = [...html.matchAll(/(\d+(?:[,\.]\d{2})?)\s*EUR/g)];
      const seenPrices = new Set();
      
      for (const match of priceMatches) {
        const price = parseFloat(match[1].replace(',', '.'));
        if (price >= 5 && price <= 10000 && !seenPrices.has(price)) {
          seenPrices.add(price);
          items.push({
            price,
            title: 'Article eBay',
            url: 'https://www.ebay.fr',
            image: null,
            platform: 'eBay'
          });
          if (items.length >= CONFIG.MAX_RESULTS) break;
        }
      }
    }

    if (items.length > 0) {
      results.prices = items;
      const priceValues = items.map(p => p.price);
      results.minPrice = Math.min(...priceValues);
      results.maxPrice = Math.max(...priceValues);
      results.avgPrice = Math.round(priceValues.reduce((a, b) => a + b, 0) / priceValues.length);
      results.count = items.length;
      results.success = true;
      console.log('[ResellScout] eBay succès:', results.count, 'articles');
    } else {
      results.error = 'Aucun résultat eBay';
    }

  } catch (error) {
    results.error = error.message;
    console.warn('[ResellScout] Erreur eBay:', error.message);
  }

  return results;
}

// ============================================
// RECHERCHE PRIX - LEBONCOIN
// ============================================

async function searchLeBonCoinPrices(query) {
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

    // Essayer l'API
    let items = await tryLeBonCoinAPI(cleanQuery);
    
    if (items.length === 0) {
      console.log('[ResellScout] LeBonCoin API vide, essai scraping...');
      items = await scrapeLeBonCoinPage(cleanQuery);
    }

    if (items.length > 0) {
      results.prices = items;
      const priceValues = items.map(p => p.price).filter(p => p > 0);
      
      if (priceValues.length > 0) {
        results.minPrice = Math.min(...priceValues);
        results.maxPrice = Math.max(...priceValues);
        results.avgPrice = Math.round(priceValues.reduce((a, b) => a + b, 0) / priceValues.length);
        results.count = priceValues.length;
        results.success = true;
        console.log('[ResellScout] LeBonCoin succès:', results.count, 'annonces');
      }
    } else {
      results.error = 'Aucun résultat LeBonCoin';
    }

  } catch (error) {
    console.warn('[ResellScout] Erreur LeBonCoin:', error.message);
    results.error = error.message;
  }

  return results;
}

async function tryLeBonCoinAPI(query) {
  const items = [];
  
  try {
    const requestBody = {
      limit: CONFIG.MAX_RESULTS,
      limit_alu: 3,
      filters: {
        category: {},
        keywords: { text: query },
        ranges: {}
      },
      sort_by: 'relevance',
      sort_order: 'desc'
    };

    const response = await fetch('https://api.leboncoin.fr/finder/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'api_key': 'ba0c2dad52b3ec',
        'Origin': 'https://www.leboncoin.fr',
        'Referer': 'https://www.leboncoin.fr/'
      },
      body: JSON.stringify(requestBody)
    });

    console.log('[ResellScout] LeBonCoin API status:', response.status);

    if (response.ok) {
      const data = await response.json();
      console.log('[ResellScout] LeBonCoin API ads:', data?.ads?.length || 0);
      
      if (data.ads && data.ads.length > 0) {
        for (const ad of data.ads) {
          if (ad.price && ad.price[0]) {
            items.push({
              price: parseFloat(ad.price[0]),
              title: ad.subject || 'Annonce LeBonCoin',
              url: ad.url || 'https://www.leboncoin.fr',
              image: ad.images?.urls?.[0] || null,
              platform: 'LeBonCoin'
            });
          }
        }
      }
    }
  } catch (e) {
    console.log('[ResellScout] LeBonCoin API error:', e.message);
  }
  
  return items;
}

async function scrapeLeBonCoinPage(query) {
  const items = [];
  
  try {
    const searchUrl = `https://www.leboncoin.fr/recherche?text=${encodeURIComponent(query)}`;
    
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9'
      }
    });

    if (!response.ok) return items;

    const html = await response.text();
    console.log('[ResellScout] LeBonCoin HTML:', html.length, 'chars');

    // Extraire les prix
    const priceMatches = [...html.matchAll(/(\d+(?:\s?\d{3})*)\s*€/g)];
    const seenPrices = new Set();
    
    for (const match of priceMatches) {
      const priceStr = match[1].replace(/\s/g, '');
      const price = parseFloat(priceStr);
      if (price >= 1 && price <= 50000 && !seenPrices.has(price)) {
        seenPrices.add(price);
        items.push({
          price: price,
          title: 'Annonce LeBonCoin',
          url: searchUrl,
          image: null,
          platform: 'LeBonCoin'
        });
        if (items.length >= CONFIG.MAX_RESULTS) break;
      }
    }
    
    console.log('[ResellScout] LeBonCoin HTML prix:', items.length);

  } catch (e) {
    console.warn('[ResellScout] LeBonCoin scrape error:', e.message);
  }
  
  return items;
}

// ============================================
// EXTRACTION DES MOTS-CLÉS
// ============================================

function extractKeywords(title) {
  if (!title) return { model: null, brand: null, keywords: [], numbers: [], searchQuery: null };
  
  let normalized = title.toLowerCase().trim()
    .replace(/core\s*/gi, '')
    .replace(/processeur\s*/gi, '')
    .replace(/\bi\s*([3579])\b/gi, 'i$1')
    .replace(/(\d{4,5})\s*([kfx]+)\b/gi, '$1$2')
    .replace(/\(.*?\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
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
  
  if (!modelMatch) {
    const cpuMatch = normalized.match(/i([3579])\s*[-]?\s*(\d{4,5})([kfx]*)/i);
    if (cpuMatch) {
      modelMatch = `i${cpuMatch[1]} ${cpuMatch[2]}${cpuMatch[3] || ''}`.trim();
    }
  }
  
  const numbers = (normalized.match(/\b\d{4,5}[a-z]*\b/gi) || []).map(n => n.toLowerCase());
  
  const brands = ['nvidia', 'amd', 'intel', 'apple', 'samsung', 'sony', 'microsoft', 'nintendo', 'asus', 'msi', 'gigabyte'];
  let brand = brands.find(b => normalized.includes(b)) || null;
  
  const stopWords = ['le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'ou', 'en', 'avec', 'pour', 'sur', 'bon', 'état', 'comme', 'neuf', 'occasion', 'vends'];
  const words = normalized.split(/\s+/).filter(w => w.length > 2 && !stopWords.includes(w));
  
  let searchQuery = modelMatch || words.slice(0, 5).join(' ');
  if (brand && !searchQuery.includes(brand)) {
    searchQuery = `${brand} ${searchQuery}`;
  }

  return { model: modelMatch, brand, keywords: words.slice(0, 10), numbers, searchQuery: searchQuery.trim() };
}

// ============================================
// SCORE DE PERTINENCE
// ============================================

function calculateRelevanceScore(result, searchKeywords) {
  if (!result || !result.title) return 0;
  
  const resultTitle = result.title.toLowerCase();
  
  const exclusiveWords = ['lot de', 'pack de', 'boîtier', 'boitier', 'alimentation', 'câble', 'housse', 'coque', 'chargeur', 'support', 'pièce', 'réparation', 'hs', 'défectueux'];
  for (const word of exclusiveWords) {
    if (resultTitle.includes(word)) return -1;
  }
  
  let score = 0, maxScore = 0;
  
  if (searchKeywords.model) {
    maxScore += 50;
    if (resultTitle.includes(searchKeywords.model.toLowerCase().replace(/\s+/g, ''))) score += 50;
    else if (resultTitle.includes(searchKeywords.model.toLowerCase())) score += 50;
  }
  
  if (searchKeywords.numbers.length > 0) {
    maxScore += 30;
    const found = searchKeywords.numbers.filter(n => resultTitle.includes(n)).length;
    score += (found / searchKeywords.numbers.length) * 30;
  }
  
  if (searchKeywords.brand) {
    maxScore += 10;
    if (resultTitle.includes(searchKeywords.brand)) score += 10;
  }
  
  if (searchKeywords.keywords.length > 0) {
    maxScore += 10;
    const found = searchKeywords.keywords.slice(0, 5).filter(kw => resultTitle.includes(kw)).length;
    score += (found / Math.min(5, searchKeywords.keywords.length)) * 10;
  }
  
  return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
}

// ============================================
// FILTRAGE DES RÉSULTATS
// ============================================

function filterRelevantResults(results, searchKeywords, minScore = 25) {
  if (!results || results.length === 0) return [];
  
  const scored = results.map(r => ({ ...r, relevanceScore: calculateRelevanceScore(r, searchKeywords) }));
  const filtered = scored.filter(r => r.relevanceScore >= minScore);
  filtered.sort((a, b) => b.relevanceScore - a.relevanceScore);
  
  console.log(`[ResellScout] Filtrage: ${results.length} → ${filtered.length}`);
  return filtered;
}

// ============================================
// AGRÉGATION DES PRIX
// ============================================

async function fetchAllPrices(productData) {
  const { title } = productData;
  
  const searchKeywords = extractKeywords(title);
  let searchQuery = searchKeywords.searchQuery || title || '';
  searchQuery = searchQuery.replace(/\d+[,.]?\d*\s*€/g, '').replace(/[^\w\s\-]/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 60);

  console.log(`[ResellScout] Recherche: "${searchQuery}"`);

  // Lancer les 3 recherches en parallèle
  const [vintedResults, leboncoinResults, ebayResults] = await Promise.allSettled([
    searchVintedPrices(searchQuery),
    searchLeBonCoinPrices(searchQuery),
    searchEbayPrices(searchQuery)
  ]);

  const occasionSources = [];
  let filteredVinted = [], filteredLeboncoin = [], filteredEbay = [];

  // Vinted
  if (vintedResults.status === 'fulfilled' && vintedResults.value.success) {
    filteredVinted = filterRelevantResults(vintedResults.value.prices, searchKeywords);
    if (filteredVinted.length > 0) {
      const pv = filteredVinted.map(p => p.price);
      occasionSources.push({ ...vintedResults.value, prices: filteredVinted, count: filteredVinted.length, minPrice: Math.min(...pv), maxPrice: Math.max(...pv), avgPrice: Math.round(pv.reduce((a, b) => a + b, 0) / pv.length) });
    }
  }
  console.log('[ResellScout] Vinted final:', filteredVinted.length);

  // LeBonCoin
  if (leboncoinResults.status === 'fulfilled' && leboncoinResults.value.success) {
    filteredLeboncoin = filterRelevantResults(leboncoinResults.value.prices, searchKeywords);
    if (filteredLeboncoin.length > 0) {
      const pv = filteredLeboncoin.map(p => p.price);
      occasionSources.push({ ...leboncoinResults.value, prices: filteredLeboncoin, count: filteredLeboncoin.length, minPrice: Math.min(...pv), maxPrice: Math.max(...pv), avgPrice: Math.round(pv.reduce((a, b) => a + b, 0) / pv.length) });
    }
  }
  console.log('[ResellScout] LeBonCoin final:', filteredLeboncoin.length);

  // eBay
  if (ebayResults.status === 'fulfilled' && ebayResults.value.success) {
    filteredEbay = filterRelevantResults(ebayResults.value.prices, searchKeywords);
    if (filteredEbay.length > 0) {
      const pv = filteredEbay.map(p => p.price);
      occasionSources.push({ ...ebayResults.value, prices: filteredEbay, count: filteredEbay.length, minPrice: Math.min(...pv), maxPrice: Math.max(...pv), avgPrice: Math.round(pv.reduce((a, b) => a + b, 0) / pv.length) });
    }
  }
  console.log('[ResellScout] eBay final:', filteredEbay.length);

  const allPrices = occasionSources.flatMap(s => s.prices.map(p => p.price));

  return {
    query: searchQuery,
    searchKeywords,
    timestamp: Date.now(),
    occasionPrice: {
      available: allPrices.length > 0,
      avg: allPrices.length > 0 ? Math.round(allPrices.reduce((a, b) => a + b, 0) / allPrices.length) : null,
      min: allPrices.length > 0 ? Math.min(...allPrices) : null,
      max: allPrices.length > 0 ? Math.max(...allPrices) : null,
      count: allPrices.length,
      sources: occasionSources.map(s => ({ name: s.source, avg: s.avgPrice, min: s.minPrice, max: s.maxPrice, count: s.count }))
    },
    rawResults: {
      vinted: { ...(vintedResults.status === 'fulfilled' ? vintedResults.value : { error: String(vintedResults.reason) }), prices: filteredVinted, filteredCount: filteredVinted.length },
      leboncoin: { ...(leboncoinResults.status === 'fulfilled' ? leboncoinResults.value : { error: String(leboncoinResults.reason) }), prices: filteredLeboncoin, filteredCount: filteredLeboncoin.length },
      ebay: { ...(ebayResults.status === 'fulfilled' ? ebayResults.value : { error: String(ebayResults.reason) }), prices: filteredEbay, filteredCount: filteredEbay.length }
    }
  };
}

// ============================================
// CALCUL DE RENTABILITÉ
// ============================================

function calculateProfitability(currentPrice, priceData) {
  const result = {
    currentPrice,
    vsOccasion: { available: priceData.occasionPrice.available, avgMarketPrice: priceData.occasionPrice.avg, difference: null, percentDiff: null, verdict: null },
    dealScore: null,
    dealRating: null,
    recommendation: null
  };

  if (priceData.occasionPrice.available && priceData.occasionPrice.avg) {
    result.vsOccasion.difference = priceData.occasionPrice.avg - currentPrice;
    result.vsOccasion.percentDiff = Math.round((result.vsOccasion.difference / priceData.occasionPrice.avg) * 100);
    
    if (result.vsOccasion.percentDiff >= 20) result.vsOccasion.verdict = 'EXCELLENT';
    else if (result.vsOccasion.percentDiff >= 10) result.vsOccasion.verdict = 'BON';
    else if (result.vsOccasion.percentDiff >= 0) result.vsOccasion.verdict = 'CORRECT';
    else if (result.vsOccasion.percentDiff >= -10) result.vsOccasion.verdict = 'ÉLEVÉ';
    else result.vsOccasion.verdict = 'TROP CHER';
  }

  let score = 50 + (result.vsOccasion.percentDiff || 0) * 2;
  score = Math.max(0, Math.min(100, score));
  result.dealScore = Math.round(score);

  if (!result.vsOccasion.available) { result.dealRating = 'DONNÉES INSUFFISANTES'; result.recommendation = 'Pas assez de données'; }
  else if (score >= 80) { result.dealRating = 'AFFAIRE EXCEPTIONNELLE'; result.recommendation = 'Acheter immédiatement!'; }
  else if (score >= 65) { result.dealRating = 'BONNE AFFAIRE'; result.recommendation = 'Prix intéressant'; }
  else if (score >= 50) { result.dealRating = 'PRIX CORRECT'; result.recommendation = 'Dans la moyenne'; }
  else if (score >= 35) { result.dealRating = 'PRIX ÉLEVÉ'; result.recommendation = 'Négocier'; }
  else { result.dealRating = 'TROP CHER'; result.recommendation = 'Éviter'; }

  return result;
}

// ============================================
// TRANSFORMATION POUR L'OVERLAY
// ============================================

function transformAnalysisForOverlay(analysis) {
  const { product, prices, profitability } = analysis;
  
  const allItems = [];
  const sourcesUsed = [];
  
  if (prices.rawResults?.vinted?.filteredCount > 0) {
    sourcesUsed.push('vinted');
    prices.rawResults.vinted.prices.forEach(item => allItems.push({ ...item, platform: 'Vinted', source: 'Vinted' }));
  }
  if (prices.rawResults?.leboncoin?.filteredCount > 0) {
    sourcesUsed.push('leboncoin');
    prices.rawResults.leboncoin.prices.forEach(item => allItems.push({ ...item, platform: 'LeBonCoin', source: 'LeBonCoin' }));
  }
  if (prices.rawResults?.ebay?.filteredCount > 0) {
    sourcesUsed.push('ebay');
    prices.rawResults.ebay.prices.forEach(item => allItems.push({ ...item, platform: 'eBay', source: 'eBay' }));
  }

  let emoji = '📊', rating = 'neutral';
  if (profitability.dealScore >= 80) { emoji = '🔥'; rating = 'excellent'; }
  else if (profitability.dealScore >= 65) { emoji = '✅'; rating = 'good'; }
  else if (profitability.dealScore >= 50) { emoji = '👍'; rating = 'fair'; }
  else if (profitability.dealScore >= 35) { emoji = '⚠️'; rating = 'high'; }
  else if (profitability.dealScore !== null) { emoji = '❌'; rating = 'bad'; }
  else { emoji = '❓'; rating = 'unknown'; }

  let confidence = prices.occasionPrice.count >= 10 ? 'high' : prices.occasionPrice.count >= 5 ? 'medium' : 'low';

  return {
    searchQuery: prices.query,
    currentPrice: product.price || 0,
    averageUsedPrice: prices.occasionPrice.avg,
    priceRange: { min: prices.occasionPrice.min, max: prices.occasionPrice.max },
    profit: profitability.vsOccasion.difference || 0,
    discount: profitability.vsOccasion.percentDiff || 0,
    emoji, rating,
    ratingLabel: profitability.dealRating || 'ANALYSE',
    recommendation: profitability.recommendation || '',
    dataPoints: prices.occasionPrice.count || 0,
    sourcesUsed,
    confidence,
    usedSources: allItems,
    timestamp: prices.timestamp
  };
}

// ============================================
// MESSAGE HANDLERS
// ============================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[ResellScout] Message:', request.action);
  
  if (request.action === 'analyzeItem') {
    const productData = {
      title: request.itemData?.title || request.itemData?.name || '',
      price: request.itemData?.price || 0,
      platform: request.itemData?.platform || 'unknown',
      image: request.itemData?.image || null,
      url: request.itemData?.url || sender.tab?.url || ''
    };
    
    handleAnalyzeProduct(productData, request.itemData?.customQuery)
      .then(result => sendResponse({ success: true, analysis: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'analyzeProduct') {
    handleAnalyzeProduct(request.data, request.customQuery)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'searchPrices') {
    fetchAllPrices({ title: request.query })
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'ping') {
    sendResponse({ success: true, message: 'pong' });
    return false;
  }
  
  return false;
});

async function handleAnalyzeProduct(productData, customQuery = null) {
  console.log('[ResellScout] Analyse:', productData.title);
  
  const searchData = customQuery ? { ...productData, title: customQuery } : productData;
  const prices = await fetchAllPrices(searchData);
  const profitability = calculateProfitability(productData.price, prices);
  
  return transformAnalysisForOverlay({ product: productData, prices, profitability });
}

console.log('[ResellScout] Service Worker v7.0 chargé');
