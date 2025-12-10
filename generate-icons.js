/**
 * Script pour générer les icônes PNG de l'extension
 * Exécuter avec Node.js : node generate-icons.js
 * Nécessite le package 'canvas' : npm install canvas
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const sizes = [16, 32, 48, 128];

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Créer le dégradé de fond
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#667eea');
  gradient.addColorStop(1, '#764ba2');
  
  // Dessiner le fond arrondi
  const radius = size * 0.15;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(size - radius, 0);
  ctx.quadraticCurveTo(size, 0, size, radius);
  ctx.lineTo(size, size - radius);
  ctx.quadraticCurveTo(size, size, size - radius, size);
  ctx.lineTo(radius, size);
  ctx.quadraticCurveTo(0, size, 0, size - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();
  
  // Dessiner un graphique simplifié
  ctx.strokeStyle = 'white';
  ctx.lineWidth = size * 0.08;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  // Barres du graphique
  const padding = size * 0.25;
  const barWidth = size * 0.12;
  const gap = size * 0.08;
  
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  
  // Barre 1
  const bar1Height = size * 0.25;
  ctx.fillRect(padding, size - padding - bar1Height, barWidth, bar1Height);
  
  // Barre 2
  const bar2Height = size * 0.4;
  ctx.fillRect(padding + barWidth + gap, size - padding - bar2Height, barWidth, bar2Height);
  
  // Barre 3
  const bar3Height = size * 0.35;
  ctx.fillRect(padding + (barWidth + gap) * 2, size - padding - bar3Height, barWidth, bar3Height);
  
  // Flèche montante
  ctx.beginPath();
  ctx.moveTo(padding, size * 0.45);
  ctx.lineTo(size - padding - size * 0.1, size * 0.3);
  ctx.stroke();
  
  // Pointe de flèche
  ctx.beginPath();
  ctx.moveTo(size - padding, size * 0.25);
  ctx.lineTo(size - padding - size * 0.15, size * 0.28);
  ctx.lineTo(size - padding - size * 0.12, size * 0.38);
  ctx.closePath();
  ctx.fillStyle = 'white';
  ctx.fill();
  
  return canvas.toBuffer('image/png');
}

// Créer le dossier si nécessaire
const outputDir = path.join(__dirname, 'assets', 'icons');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Générer les icônes
sizes.forEach(size => {
  const buffer = generateIcon(size);
  const filename = path.join(outputDir, `icon${size}.png`);
  fs.writeFileSync(filename, buffer);
  console.log(`Icône générée: ${filename}`);
});

console.log('Toutes les icônes ont été générées!');
