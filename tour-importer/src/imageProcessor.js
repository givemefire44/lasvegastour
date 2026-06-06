// src/imageProcessor.js
import sharp from 'sharp';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Crear carpeta temporal si no existe
const tempDir = path.join(__dirname, '../temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Configuración de dimensiones mínimas
const MIN_WIDTH = 600;
const MIN_HEIGHT = 600;

/**
 * Descarga una imagen desde una URL
 */
async function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const file = fs.createWriteStream(filepath);
    
    protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve(filepath);
      });
    }).on('error', (err) => {
      fs.unlink(filepath, () => {}); // Borrar archivo parcial
      reject(err);
    });
  });
}

/**
 * Convierte imagen a JPG optimizado y valida dimensiones
 * ✅ MEJORADO: Manejo especial para AVIF
 */
async function convertToJpg(inputPath, outputPath) {
  // Obtener metadata de la imagen
  const metadata = await sharp(inputPath).metadata();
  
  console.log(`      📐 Dimensiones: ${metadata.width}x${metadata.height}px`);
  console.log(`      📄 Formato original: ${metadata.format}`);
  
  // Validar dimensiones mínimas
  if (metadata.width < MIN_WIDTH || metadata.height < MIN_HEIGHT) {
    console.warn(`      ⚠️ Imagen muy pequeña (mínimo ${MIN_WIDTH}x${MIN_HEIGHT}px)`);
  }
  
  // ✅ MANEJO ESPECIAL PARA AVIF - Conversión en dos pasos
  if (metadata.format === 'avif') {
    console.log(`      🔄 Conversión AVIF → PNG → JPG (alta calidad)`);
    
    // Paso 1: AVIF → PNG sin pérdida
    const pngPath = inputPath.replace('.tmp', '-temp.png');
    await sharp(inputPath)
      .png({
        compressionLevel: 0, // Sin compresión para no perder datos
        quality: 100
      })
      .toFile(pngPath);
    
    console.log(`      ✓ Decodificado a PNG`);
    
    // Paso 2: PNG → JPG máxima calidad
    await sharp(pngPath)
      .jpeg({
        quality: 98, // Calidad máxima
        chromaSubsampling: '4:4:4', // Sin pérdida de información de color
        mozjpeg: true // Mejor algoritmo de compresión
      })
      .toFile(outputPath);
    
    console.log(`      ✓ Convertido a JPG (quality: 98, 4:4:4)`);
    
    // Limpiar PNG temporal
    try {
      fs.unlinkSync(pngPath);
    } catch (e) {
      // Ignorar si no existe
    }
    
  } else {
    // Otros formatos (JPG, PNG, WebP) - conversión directa
    console.log(`      🔄 Conversión directa a JPG`);
    
    await sharp(inputPath)
      .jpeg({
        quality: 95,
        chromaSubsampling: '4:4:4',
        mozjpeg: true
      })
      .toFile(outputPath);
    
    console.log(`      ✓ Convertido a JPG (quality: 95)`);
  }
  
  return {
    path: outputPath,
    width: metadata.width,
    height: metadata.height
  };
}

/**
 * Procesa array de URLs de imágenes
 * Descarga, convierte a JPG, retorna buffers
 */
export async function processImages(imageUrls) {
  console.log(`\n📸 Procesando ${imageUrls.length} imágenes...`);
  
  const processedImages = [];
  
  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i];
    console.log(`   [${i + 1}/${imageUrls.length}] Procesando imagen...`);
    console.log(`      🔗 URL: ${url.substring(0, 80)}...`);
    
    try {
      // Paths temporales
      const tempFilename = `temp-${Date.now()}-${i}`;
      const downloadPath = path.join(tempDir, `${tempFilename}.tmp`);
      const jpgPath = path.join(tempDir, `${tempFilename}.jpg`);
      
      // Descargar
      await downloadImage(url, downloadPath);
      console.log(`      ✓ Descargada`);
      
      // Convertir a JPG y obtener dimensiones
      const result = await convertToJpg(downloadPath, jpgPath);
      
      // Leer como buffer
      const buffer = fs.readFileSync(jpgPath);
      
      // Limpiar archivos temporales
      fs.unlinkSync(downloadPath);
      fs.unlinkSync(jpgPath);
      
      processedImages.push({
        buffer,
        filename: `tour-image-${i + 1}.jpg`,
        mimeType: 'image/jpeg',
        width: result.width,
        height: result.height,
        alt: `Tour image ${i + 1}` // Alt text por defecto
      });
      
      console.log(`   ✅ Imagen ${i + 1} procesada (${result.width}x${result.height}px)`);
      
    } catch (error) {
      console.error(`   ❌ Error procesando imagen ${i + 1}:`, error.message);
      // Continuar con las demás imágenes
    }
  }
  
  console.log(`✅ ${processedImages.length}/${imageUrls.length} imágenes procesadas correctamente`);
  
  // Mostrar resumen de dimensiones
  if (processedImages.length > 0) {
    console.log('\n📊 Resumen de dimensiones:');
    processedImages.forEach((img, idx) => {
      console.log(`   ${idx + 1}. ${img.width}x${img.height}px`);
    });
  }
  
  return processedImages;
}

/**
 * Limpia carpeta temporal
 */
export function cleanupTempFiles() {
  if (fs.existsSync(tempDir)) {
    const files = fs.readdirSync(tempDir);
    files.forEach(file => {
      fs.unlinkSync(path.join(tempDir, file));
    });
    console.log('🧹 Archivos temporales limpiados');
  }
}