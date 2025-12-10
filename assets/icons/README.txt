Instructions pour les icônes ResellScout
========================================

L'extension nécessite des icônes PNG aux dimensions suivantes :
- icon16.png (16x16 pixels)
- icon32.png (32x32 pixels)
- icon48.png (48x48 pixels)
- icon128.png (128x128 pixels)

Pour créer ces icônes :

1. Utilisez le fichier icon.svg comme source
2. Exportez en PNG aux différentes tailles avec un outil comme :
   - Figma (gratuit en ligne)
   - Inkscape (gratuit)
   - Adobe Illustrator
   - GIMP
   - Ou un convertisseur en ligne comme svgtopng.com

3. Placez les fichiers PNG dans ce dossier (assets/icons/)

Design suggéré :
- Fond dégradé violet (#667eea → #764ba2)
- Emoji 📊 ou icône graphique au centre
- Coins arrondis

Alternative temporaire :
Vous pouvez créer des icônes simples avec ce code canvas JavaScript :

```javascript
function createIcon(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  // Dégradé de fond
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#667eea');
  gradient.addColorStop(1, '#764ba2');
  
  // Rectangle arrondi
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, size * 0.15);
  ctx.fill();
  
  // Texte/Emoji
  ctx.fillStyle = 'white';
  ctx.font = `${size * 0.5}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('📊', size/2, size/2);
  
  return canvas.toDataURL('image/png');
}
```
