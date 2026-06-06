#!/usr/bin/env node
/**
 * produce-all.mjs
 *
 * BATCH DE PRODUCCIÓN — corre produce-article.mjs para CADA artículo
 * de la arquitectura, uno tras otro.
 *
 * Default: skipea artículos ya producidos (chequea si existe el .md).
 * Si querés re-producir todo, usá --force.
 *
 * Uso:
 *   node produce-all.mjs                # produce solo lo que falta
 *   node produce-all.mjs --force        # re-produce TODO (sobrescribe)
 *   node produce-all.mjs --dry-run      # muestra qué haría, sin ejecutar
 *   node produce-all.mjs --only-pillars # produce solo los 9 pillars
 *   node produce-all.mjs --hub=X        # produce solo los del hub X
 *
 * Output:
 *   - Cada artículo en articles/{hub-id}/{slug}.md
 *   - batch-log.json con el resumen final
 */

import { spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { writeFileSync } from 'fs';
import { join } from 'path';

const ARCHITECTURE_PATH = './architecture.json';
const OUTPUT_DIR = './articles';

const args = process.argv.slice(2);
const isForce = args.includes('--force');
const isDryRun = args.includes('--dry-run');
const onlyPillars = args.includes('--only-pillars');
const hubFilter = args.find(a => a.startsWith('--hub='))?.split('=')[1];

if (!existsSync(ARCHITECTURE_PATH)) {
  console.error(`❌ No encontré ${ARCHITECTURE_PATH}`);
  process.exit(1);
}

const architecture = JSON.parse(readFileSync(ARCHITECTURE_PATH, 'utf8'));

// ═══════════════════════════════════════════════════════════════════
// 1. ARMAR LISTADO COMPLETO DE TAREAS
// ═══════════════════════════════════════════════════════════════════
function slugify(s) {
  return s.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

const tasks = [];
for (const hub of architecture.hubs) {
  if (hubFilter && hub.id !== hubFilter) continue;

  // Pillar
  tasks.push({
    hubId: hub.id,
    hubName: hub.name,
    type: 'pillar',
    title: hub.pillar.title,
    args: ['--hub=' + hub.id, '--pillar'],
    expectedFile: join(OUTPUT_DIR, hub.id, slugify(hub.pillar.title) + '.md'),
  });

  if (!onlyPillars) {
    (hub.supporting_articles || []).forEach((art, i) => {
      tasks.push({
        hubId: hub.id,
        hubName: hub.name,
        type: 'supporting',
        title: art.title,
        args: ['--hub=' + hub.id, '--supporting=' + (i + 1)],
        expectedFile: join(OUTPUT_DIR, hub.id, slugify(art.title) + '.md'),
      });
    });
  }
}

// Filtrar lo ya producido (a menos que --force)
const tasksToRun = isForce
  ? tasks
  : tasks.filter(t => !existsSync(t.expectedFile));

const tasksSkipped = tasks.length - tasksToRun.length;

console.log('━'.repeat(70));
console.log('📦 BATCH DE PRODUCCIÓN — Plan de ejecución');
console.log('━'.repeat(70));
console.log(`Total artículos en arquitectura: ${tasks.length}`);
console.log(`Ya producidos (skip):            ${tasksSkipped}`);
console.log(`A producir ahora:                ${tasksToRun.length}`);
if (isForce) console.log(`⚠️  Modo --force: se sobrescribirán los existentes`);
if (onlyPillars) console.log(`ℹ️  Modo --only-pillars: solo pillars, no supportings`);
if (hubFilter) console.log(`ℹ️  Filtro hub=${hubFilter}`);
console.log('');

if (tasksToRun.length === 0) {
  console.log('✅ Todo ya está producido. Nada que hacer.');
  process.exit(0);
}

console.log('Tareas a ejecutar:');
tasksToRun.forEach((t, i) => {
  console.log(`  ${(i + 1).toString().padStart(2)}. [${t.type.padEnd(10)}] ${t.hubId} → ${t.title.slice(0, 60)}`);
});
console.log('');

if (isDryRun) {
  console.log('🚧 Modo --dry-run: no se ejecuta nada. Salgo.');
  process.exit(0);
}

// Estimación de costo y tiempo
const estimatedCostUSD = tasksToRun.length * 0.35;
const estimatedMinutes = (tasksToRun.length * 170) / 60;
console.log(`💰 Costo estimado: ~$${estimatedCostUSD.toFixed(2)} USD`);
console.log(`⏱️  Tiempo estimado: ~${estimatedMinutes.toFixed(0)} minutos (${(estimatedMinutes / 60).toFixed(1)} horas)`);
console.log('');
console.log('Empezando en 5 segundos... (Ctrl+C para abortar)');
await new Promise(r => setTimeout(r, 5000));
console.log('');

// ═══════════════════════════════════════════════════════════════════
// 2. EJECUTAR UNA POR UNA
// ═══════════════════════════════════════════════════════════════════
function runTask(task) {
  return new Promise((resolve) => {
    const start = Date.now();
    const child = spawn('node', ['produce-article.mjs', ...task.args], {
      stdio: 'inherit',
      shell: false,
    });
    child.on('close', (code) => {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      resolve({ code, elapsed, ok: code === 0 });
    });
    child.on('error', (err) => {
      resolve({ code: -1, error: err.message, elapsed: 0, ok: false });
    });
  });
}

const results = [];
const totalStart = Date.now();

for (let i = 0; i < tasksToRun.length; i++) {
  const task = tasksToRun[i];
  console.log('');
  console.log('═'.repeat(70));
  console.log(`📝 [${i + 1}/${tasksToRun.length}] ${task.hubId} — ${task.type}`);
  console.log(`   ${task.title}`);
  console.log('═'.repeat(70));

  const result = await runTask(task);

  results.push({
    n: i + 1,
    hub: task.hubId,
    type: task.type,
    title: task.title,
    ok: result.ok,
    elapsed_seconds: parseFloat(result.elapsed),
    error: result.error || null,
  });

  // Pausa breve para no saturar API
  if (i < tasksToRun.length - 1) {
    console.log('');
    console.log('⏸️  Pausa 3s antes del próximo...');
    await new Promise(r => setTimeout(r, 3000));
  }
}

// ═══════════════════════════════════════════════════════════════════
// 3. RESUMEN FINAL
// ═══════════════════════════════════════════════════════════════════
const totalElapsed = ((Date.now() - totalStart) / 1000 / 60).toFixed(1);
const okCount = results.filter(r => r.ok).length;
const failCount = results.filter(r => !r.ok).length;

console.log('');
console.log('━'.repeat(70));
console.log('🏁 BATCH COMPLETADO');
console.log('━'.repeat(70));
console.log(`Tiempo total:    ${totalElapsed} minutos`);
console.log(`Exitosos:        ${okCount}/${tasksToRun.length}`);
console.log(`Fallidos:        ${failCount}/${tasksToRun.length}`);
console.log('');

if (failCount > 0) {
  console.log('❌ Artículos fallidos:');
  results.filter(r => !r.ok).forEach(r => {
    console.log(`   - ${r.hub} → ${r.title}`);
    if (r.error) console.log(`     Error: ${r.error}`);
  });
  console.log('');
  console.log('💡 Para reintentar los fallidos, corré los individuales con produce-article.mjs');
  console.log('');
}

// Guardar log
writeFileSync(
  './batch-log.json',
  JSON.stringify({
    started_at: new Date(totalStart).toISOString(),
    finished_at: new Date().toISOString(),
    total_minutes: parseFloat(totalElapsed),
    total_tasks: tasksToRun.length,
    successful: okCount,
    failed: failCount,
    results,
  }, null, 2),
  'utf8'
);
console.log('💾 Log guardado en ./batch-log.json');
console.log('');
console.log('Próximos pasos:');
console.log('  1. Revisar artículos en ./articles/{hub-id}/');
console.log('  2. Si algún fallido, regenerarlo con produce-article.mjs');
console.log('  3. Pasar a redacción para armado en Sanity');