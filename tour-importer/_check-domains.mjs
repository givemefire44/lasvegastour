// Chequea www vs no-www + canonical en todos los dominios del portfolio.
// Solo lectura, no toca nada. Uso: node _check-domains.mjs

const domains = [
    'colosseumroman.com',
    'louvretourguide.com',
    'pompeiitourguides.com',
    'milanlastsupper.com',
    'scooterstour.com',
    'tirepath.com',
    'sagradafamiliatourguide.com',
    'lasvegastour.com',
  ];
  
  // pide una URL SIN seguir redirects, devuelve {status, location}
  async function head(url) {
    try {
      const r = await fetch(url, { method: 'GET', redirect: 'manual' });
      return { status: r.status, location: r.headers.get('location') || '' };
    } catch (e) {
      return { status: 'ERR', location: e.message };
    }
  }
  
  // sigue redirects y saca el canonical del HTML
  async function canonical(url) {
    try {
      const r = await fetch(url, { redirect: 'follow' });
      const html = await r.text();
      const m = html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)
             || html.match(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["']canonical["']/i);
      return { finalUrl: r.url, canon: m ? m[1] : '(sin canonical)' };
    } catch (e) {
      return { finalUrl: '', canon: 'ERR ' + e.message };
    }
  }
  
  for (const d of domains) {
    console.log(`\n=== ${d} ===`);
    const noWww = await head(`https://${d}/`);
    const www   = await head(`https://www.${d}/`);
    console.log(`  sin www -> ${noWww.status}${noWww.location ? ' -> ' + noWww.location : ' (sirve)'}`);
    console.log(`  con www -> ${www.status}${www.location ? ' -> ' + www.location : ' (sirve)'}`);
    const c = await canonical(`https://${d}/`);
    console.log(`  canonical home: ${c.canon}`);
    // veredicto simple
    const servesNoWww = (noWww.status === 200);
    const servesWww = (www.status === 200);
    const canonHasWww = /\/\/www\./.test(c.canon);
    let verdict = '';
    if (servesNoWww && !servesWww && !canonHasWww) verdict = 'OK (todo sin-www, coherente)';
    else if (servesWww && !servesNoWww && canonHasWww) verdict = 'OK (todo con-www, coherente)';
    else if (servesNoWww && servesWww) verdict = 'OJO: las DOS versiones sirven 200 (duplicado)';
    else verdict = 'OJO: revisar (redirect y canonical podrian no coincidir)';
    console.log(`  >> ${verdict}`);
  }
  console.log('\nListo.');
  