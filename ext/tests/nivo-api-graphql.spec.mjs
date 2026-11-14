// The decisions of the project check `nivo-api-graphql` (ext/support/nivo-api-graphql-rules.mjs) on fixtures.
import { strict as assert } from "node:assert"
import { test } from "node:test"
import { claimedApiNames, findingsOf, rootFieldsOf } from "../support/nivo-api-graphql-rules.mjs"

const SDL = `
type Query { contact(input: ID!): String contacts: String }
type Mutation { mergeContacts: String }
extend type Mutation { deleteContact: Boolean }
type Other { contact: String }
`
const roots = rootFieldsOf(SDL)
const names = ["nivo.api.nivo.contact.get", "nivo.api.nivo.contact.merge"]
const table = {
    "nivo.api.nivo.contact.get": { kind: "query", operation: "contact" },
    "nivo.api.nivo.contact.merge": { kind: "mutation", operation: "mergeContacts" },
}
const run = (over = {}) => findingsOf({ names, table, roots, claims: {}, ...over })

test("the roots come from type and extend type, never from another type", () => {
    assert.deepEqual([...roots.query].sort(), ["contact", "contacts"])
    assert.deepEqual([...roots.mutation].sort(), ["deleteContact", "mergeContacts"])
})

test("a table that matches the contract: no finding", () => {
    assert.deepEqual(run(), [])
})

test("an API name without a row is a finding", () => {
    const found = run({ names: [...names, "nivo.api.nivo.contact.list"] })
    assert.equal(found.length, 1)
    assert.match(found[0], /contact\.list: no row/u)
})

test("a row for an undeclared API name is a finding", () => {
    const found = run({ table: { ...table, "nivo.api.nivo.contact.gone": { kind: "query", operation: "contacts" } } })
    assert.match(found.join("\n"), /contact\.gone: a row .* not declared/u)
})

test("a row naming a field the contract lacks is a finding", () => {
    const found = run({ table: { ...table, "nivo.api.nivo.contact.merge": { kind: "mutation", operation: "mergeThem" } } })
    assert.match(found.join("\n"), /no mutation `mergeThem`/u)
})

test("a row of the wrong kind is a finding", () => {
    const found = run({ table: { ...table, "nivo.api.nivo.contact.merge": { kind: "query", operation: "mergeContacts" } } })
    assert.match(found.join("\n"), /is a mutation of the contract, the row says query/u)
})

test("two API names on one operation are a finding", () => {
    const found = run({
        names: [...names, "nivo.api.nivo.contact.read"],
        table: { ...table, "nivo.api.nivo.contact.read": { kind: "query", operation: "contact" } },
    })
    assert.equal(found.length, 1)
    assert.match(found[0], /query contact: served by 2 API names/u)
})

test("a claim of an undeclared API name in a resolver or the contract is a finding", () => {
    assert.deepEqual(claimedApiNames("`nivo.api.nivo.contact.list` / `nivo.api.nivo.file.get`, then `.confirm`."), [
        "nivo.api.nivo.contact.list",
        "nivo.api.nivo.file.get",
    ])
    assert.deepEqual(claimedApiNames("the `nivo.api.nivo.contact.*` family and `nivo.api.nivo.contact.{list,get}`"), [])
    const found = run({ claims: { "a.resolver.ts": "/** `nivo.api.nivo.contact.merge` and `nivo.api.nivo.contact.nope`. */" } })
    assert.equal(found.length, 1)
    assert.match(found[0], /a\.resolver\.ts: claims `nivo\.api\.nivo\.contact\.nope`/u)
})
