const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1600, height: 950 } });
  const errs = []; p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); }); p.on('pageerror', (e) => errs.push('PE ' + e.message.slice(0, 200)));
  await p.goto('http://127.0.0.1:3150/flow.html', { waitUntil: 'load', timeout: 180000 }); await p.waitForTimeout(8000);
  const pill = process.argv[2]; if (pill) { await p.getByRole('button', { name: pill }).first().click(); await p.waitForTimeout(3000); }
  if (process.argv[3]) { await p.locator('.react-flow__node').nth(Number(process.argv[3])).click({ position: { x: 100, y: 12 } }); await p.waitForTimeout(1200); }
  await p.screenshot({ path: __dirname + '/_flow.png' });
  console.log('nodes', await p.locator('.react-flow__node').count(), 'edges', await p.locator('.react-flow__edge').count(), 'hot', await p.locator('.fm-hot').count(), errs.join(' | '));
  await b.close();
})();
