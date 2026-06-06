import fs from 'fs';

const PATH = 'C:/Users/Noxi-PC/lasvegastour/.env.local';

if (!fs.existsSync(PATH)) {
  console.log('ABORTADO - no existe .env.local en Vaticano.');
  console.log('Primero copia el de Colosseum:');
  console.log('  Copy-Item "C:\\Users\\Noxi-PC\\colosseumroman-blog\\.env.local" "C:\\Users\\Noxi-PC\\lasvegastour\\.env.local"');
  process.exit(1);
}

const raw = fs.readFileSync(PATH, 'utf8');
const hadCRLF = raw.includes('\r\n');
let content = raw.replace(/\r\n/g, '\n');

const changes = [
  ['NEXT_PUBLIC_SANITY_PROJECT_ID', 'kabmqky1'],
  ['SANITY_PROJECT_ID', 'kabmqky1'],
  ['NEXT_PUBLIC_SANITY_DATASET', 'production'],
  ['SANITY_DATASET', 'production'],
  ['NEXT_PUBLIC_GA_TRACKING_ID', ''],
  ['NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION', ''],
];

const log = [];
for (const [key, value] of changes) {
  const re = new RegExp('^' + key + '=.*$', 'm');
  if (re.test(content)) {
    content = content.replace(re, key + '=' + value);
    log.push('  cambiado: ' + key + '=' + (value || '(vacio)'));
  } else {
    content += (content.endsWith('\n') ? '' : '\n') + key + '=' + value + '\n';
    log.push('  agregado: ' + key + '=' + (value || '(vacio)'));
  }
}

if (hadCRLF) content = content.replace(/\n/g, '\r\n');
fs.writeFileSync(PATH, content, 'utf8');

console.log('OK - .env.local de Vaticano actualizado:');
console.log(log.join('\n'));
console.log('');
console.log('FALTA (manual, son secrets): genera un token NUEVO en el proyecto Sanity de Vaticano');
console.log('(sanity.io -> tu proyecto -> API -> Tokens -> Add token, permisos Editor)');
console.log('y reemplaza el valor de estas dos lineas con ese token:');
console.log('  SANITY_API_TOKEN=...');
console.log('  SANITY_TOKEN=...');
