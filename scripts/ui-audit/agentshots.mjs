// scratch: agent pages x widths, plus the run detail
import { loadPlaywright, openSession, persist, BASE } from './auth.mjs'
const [out, tag] = process.argv.slice(2)
const A = { accounting: '1d24b4e0-d276-4ecb-a0e9-07bd01395630', chatbot: '1ea3eaee-ace5-46d1-a45d-c892a75252b6', sales: '12732e05-8cf1-44da-969b-cf289b2b85fa' }
const TABS = ['workbench', 'work', 'work?view=runs', 'chat', 'connections', 'knowledge', 'setup', 'setup/workflows', 'setup/general']
const widths = (process.env.WIDTHS || '1440,1920,390').split(',').map(Number)
const only = process.env.ONLY ? process.env.ONLY.split(',') : Object.keys(A)
const { chromium } = loadPlaywright()
const b = await chromium.launch()
for (const w of widths) {
  const { ctx, ws } = await openSession(b, w)
  const p = await ctx.newPage()
  for (const k of only) {
    for (const t of TABS) {
      const slug = `${k}-${t.replace(/[/?=]/g, '-')}`
      try {
        await p.goto(`${BASE}/workspaces/${ws}/agents/${k}/${A[k]}/${t}`, { waitUntil: 'networkidle', timeout: 90000 })
        await p.waitForTimeout(1500)
        await p.screenshot({ path: `${out}/${slug}__${w}__${tag}.png`, fullPage: true })
        if (t === 'work?view=runs') {
          const row = p.getByText(/^Lượt chạy #/).first()
          if (await row.count()) {
            await row.click(); await p.waitForLoadState('networkidle'); await p.waitForTimeout(2500)
            await p.screenshot({ path: `${out}/${k}-run-detail__${w}__${tag}.png`, fullPage: true })
            console.log('run', k, p.url())
          }
        }
      } catch (e) { console.log('fail', slug, w, String(e.message).slice(0, 80)) }
    }
  }
  await persist(ctx)
  await ctx.close()
}
await b.close()
