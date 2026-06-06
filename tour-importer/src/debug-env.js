// debug-env.js
// Script para verificar que las variables de entorno se cargan correctamente

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

console.log('🔍 DEBUG - Variables de entorno:\n');
console.log('SANITY_PROJECT_ID:', process.env.SANITY_PROJECT_ID);
console.log('SANITY_DATASET:', process.env.SANITY_DATASET);
console.log('SANITY_TOKEN:', process.env.SANITY_TOKEN ? 'SET ✅' : 'NOT SET ❌');
console.log('ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? 'SET ✅' : 'NOT SET ❌');

console.log('\n📁 Directorio actual:', process.cwd());