# ResellScout - Extension de Navigateur 📊

**Analyseur de Rentabilité pour LeBonCoin et Vinted**

ResellScout est une extension de navigateur qui vous aide à analyser automatiquement la rentabilité des articles en vente sur LeBonCoin et Vinted. Parfait pour les revendeurs et les chasseurs de bonnes affaires !

## 🎯 Fonctionnalités

- **100% Prix Réels** : Aucune estimation - uniquement des prix récupérés du marché actuel
- **Extraction automatique des données** : Récupère le titre, le prix, la marque et l'état de l'article
- **Analyse multi-sources** : Compare les prix sur plusieurs plateformes
- **Sources Prix Occasion** : Vinted, LeBonCoin
- **Sources Prix Neuf** : Google Shopping, Amazon, FNAC, CDiscount
- **Calcul de rentabilité** : Compare avec les prix réels du marché
- **Notation des affaires** : Classifie les deals en Excellente Affaire, Bonne Affaire, Prix Correct ou Surévalué
- **Widget discret** : Interface flottante avec Shadow DOM (n'affecte pas les styles du site)
- **Historique** : Garde une trace de vos analyses récentes

## 📦 Installation

### Chrome / Edge

1. Téléchargez ou clonez ce repository
2. Ouvrez `chrome://extensions/` (ou `edge://extensions/`)
3. Activez le "Mode développeur" en haut à droite
4. Cliquez sur "Charger l'extension non empaquetée"
5. Sélectionnez le dossier `ResellScout`

### Firefox

1. Ouvrez `about:debugging#/runtime/this-firefox`
2. Cliquez sur "Charger un module temporaire"
3. Sélectionnez le fichier `manifest.json` dans le dossier `ResellScout`

## 🚀 Utilisation

1. Naviguez sur une page produit sur [Vinted](https://www.vinted.fr) ou [LeBonCoin](https://www.leboncoin.fr)
2. L'extension analyse automatiquement l'article
3. Un widget apparaît en bas à droite avec :
   - Le badge de notation (🔥 Excellente, 👍 Bonne, ➡️ Correcte, ⚠️ Surévaluée)
   - Le tableau comparatif des prix
   - Le profit potentiel estimé

## 📁 Structure du Projet

```
ResellScout/
├── manifest.json                 # Configuration Manifest V3
├── _locales/
│   └── fr/
│       └── messages.json         # Traductions françaises
├── assets/
│   └── icons/
│       └── icon.svg              # Icône de l'extension
├── src/
│   ├── background/
│   │   └── service-worker.js     # Service Worker (APIs, calculs)
│   ├── content/
│   │   ├── main.js               # Point d'entrée content script
│   │   ├── scrapers/
│   │   │   ├── vinted-scraper.js # Scraper Vinted
│   │   │   └── leboncoin-scraper.js # Scraper LeBonCoin
│   │   ├── ui/
│   │   │   ├── overlay.js        # Widget flottant
│   │   │   └── styles.css        # Styles additionnels
│   │   └── utils/
│   │       └── helpers.js        # Utilitaires communs
│   └── popup/
│       ├── popup.html            # Interface popup
│       ├── popup.css             # Styles popup
│       └── popup.js              # Logique popup
└── README.md
```

## ⚙️ Configuration des APIs (Optionnel)

Pour des résultats plus précis, vous pouvez configurer des APIs externes :

### Google Custom Search API

1. Créez un projet sur [Google Cloud Console](https://console.cloud.google.com/)
2. Activez l'API Custom Search
3. Créez une clé API
4. Créez un moteur de recherche personnalisé sur [CSE](https://cse.google.com/)
5. Modifiez `src/background/service-worker.js` :

```javascript
const API_CONFIG = {
  googleSearch: {
    apiKey: 'VOTRE_CLE_API',
    searchEngineId: 'VOTRE_SEARCH_ENGINE_ID',
    enabled: true
  }
};
```

### eBay Finding API

1. Créez un compte développeur sur [eBay Developers](https://developer.ebay.com/)
2. Obtenez un App ID
3. Modifiez la configuration :

```javascript
const API_CONFIG = {
  ebay: {
    appId: 'VOTRE_APP_ID',
    enabled: true
  }
};
```

## 🔧 Développement

### Prérequis

- Navigateur compatible (Chrome 88+, Firefox 89+, Edge 88+)
- Connaissances en JavaScript/ES6

### Mise à jour des sélecteurs

Les sites web changent régulièrement leurs structures. Si l'extraction ne fonctionne plus :

1. Inspectez la page avec les DevTools
2. Mettez à jour les sélecteurs dans `vinted-scraper.js` ou `leboncoin-scraper.js`
3. Rechargez l'extension

### Ajout d'une nouvelle plateforme

1. Créez un nouveau scraper dans `src/content/scrapers/`
2. Ajoutez les patterns d'URL dans `manifest.json`
3. Mettez à jour `main.js` pour détecter la nouvelle plateforme

## 📊 Notation des Affaires

| Note | Condition | Couleur |
|------|-----------|---------|
| 🔥 Excellente Affaire | >40% sous le prix du marché | Vert |
| 👍 Bonne Affaire | 20-40% sous le prix du marché | Bleu |
| ➡️ Prix Correct | Prix du marché | Orange |
| ⚠️ Surévalué | Au-dessus du prix du marché | Rouge |

## 🔒 Confidentialité

- **Aucune donnée personnelle collectée**
- Les données d'historique sont stockées **localement** dans votre navigateur
- Aucune communication avec des serveurs tiers (sauf si vous activez les APIs)

## 🐛 Problèmes Connus

- Les sélecteurs peuvent devenir obsolètes après une mise à jour des sites
- L'estimation des prix est approximative sans API configurée
- Certaines pages SPA peuvent nécessiter un rechargement manuel

## 📄 Licence

MIT License - Voir le fichier LICENSE pour plus de détails.

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :

1. Fork le projet
2. Créer une branche (`git checkout -b feature/AmazingFeature`)
3. Commit vos changements (`git commit -m 'Add AmazingFeature'`)
4. Push sur la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

---

**Made with ❤️ pour les revendeurs**
