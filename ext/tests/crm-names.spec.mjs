// The decisions of the project check `crm-names` (ext/support/crm-names-rules.mjs) on fixtures.
import { strict as assert } from "node:assert"
import { test } from "node:test"
import { sameJson, templateFindings, usedOpFindings } from "../support/crm-names-rules.mjs"

const doc = (paths = { "/products": { get: {} } }) => ({ openapi: "3.0.3", info: { title: "x", version: "1" }, paths })
const crm = (id, openapi = doc()) => ({ kind: "crm", id, openapi })
const pkg = (name, templates, pinned = templates.map((template) => [template.id, template.openapi])) => ({ name, templates, pinned: new Map(pinned) })

test("one package, one template whose openapi is its pinned file: no finding", () => {
    assert.deepEqual(templateFindings([pkg("web", [crm("nivoweb")]), pkg("core", [])]), [])
})

test("the pinned file is compared by content, not key order", () => {
    const pinned = { paths: { "/products": { get: {} } }, info: { version: "1", title: "x" }, openapi: "3.0.3" }
    assert.deepEqual(templateFindings([pkg("web", [crm("nivoweb")], [["nivoweb", pinned]])]), [])
    assert.equal(sameJson([1, 2], [2, 1]), false)
})

test("a template id two packages declare is one finding naming both", () => {
    const found = templateFindings([pkg("web", [crm("nivoweb")]), pkg("other", [crm("nivoweb")])])
    assert.equal(found.length, 1)
    assert.match(found[0].text, /`nivoweb` is declared 2 times \(web, other\)/u)
})

test("a template with no pinned document, or one that differs from it, is a finding", () => {
    const missing = templateFindings([pkg("web", [crm("nivoweb")], [])])
    assert.deepEqual(missing.map((one) => one.text), ["template `crm.nivoweb` has no pinned src/crm/nivoweb/openapi.json"])
    const differs = templateFindings([pkg("web", [crm("nivoweb")], [["nivoweb", doc({ "/orders": { get: {} } })]])])
    assert.match(differs[0].text, /its `openapi` is not the pinned/u)
})

test("a pinned folder no template declares is a finding", () => {
    const found = templateFindings([pkg("web", [], [["nivoweb", doc()]])])
    assert.match(found[0].text, /pinned but no `defineProviderTemplate`/u)
})

const use = (text) => {
    const [, id, rest] = /^nivo\.api\.crm\.([a-z][a-z0-9-]*)((?:\.[A-Za-z0-9_-]+)*)$/u.exec(text)
    return { file: "src/x.ts", line: 3, text, id, rest }
}
const ops = new Map([["nivoweb", new Set(["nivo.api.crm.nivoweb.get.products"])]])

test("a used op the package's template document holds: no finding; a bare id prefix checks only the id", () => {
    assert.deepEqual(usedOpFindings([use("nivo.api.crm.nivoweb.get.products"), use("nivo.api.crm.nivoweb")], ops), [])
})

test("an op the document lacks is a finding at its file and line", () => {
    const [found] = usedOpFindings([use("nivo.api.crm.nivoweb.delete.products")], ops)
    assert.equal(found.line, 3)
    assert.match(found.problem, /is no operation of the document the package pins for CRM `nivoweb`/u)
})

test("an id the package declares no template for (another package's CRM) is a finding", () => {
    const [found] = usedOpFindings([use("nivo.api.crm.othercrm.get.products")], ops)
    assert.match(found.problem, /declares no CRM template `othercrm`/u)
    assert.equal(usedOpFindings([use("nivo.api.crm.nivoweb.get.products")], new Map()).length, 1)
})
