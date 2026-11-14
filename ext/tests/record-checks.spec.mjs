// The decisions of the project checks `record-names` and `record-ddl` (ext/support/record-checks-rules.mjs) on fixtures.
import { strict as assert } from "node:assert"
import { test } from "node:test"
import { ddlDrift, findingLines, manifestDelta, packageNameFindings, sameJson, unscopedOf } from "../support/record-checks-rules.mjs"

test("the package name is the npm name without its scope", () => {
    assert.equal(unscopedOf("@nivo-lite/blocks-core"), "blocks-core")
    assert.equal(unscopedOf("plain"), "plain")
})

test("a plugin that declares its package name truthfully: no finding", () => {
    assert.deepEqual(packageNameFindings([{ packageJsonName: "@nivo-lite/blocks-core", plugin: { key: "core", packageName: "blocks-core" } }]), [])
})

test("a missing or a wrong package name is a finding named by its plugin", () => {
    assert.deepEqual(
        packageNameFindings([
            { packageJsonName: "@nivo-lite/shop", plugin: { key: "shop" } },
            { packageJsonName: "@nivo-lite/web", plugin: { key: "web", packageName: "nivo-web" } },
        ]).map((finding) => [finding.plugin, finding.code]),
        [
            ["shop", "PLUGIN_PACKAGE_NAME_MISSING"],
            ["web", "PLUGIN_PACKAGE_NAME_MISMATCH"],
        ],
    )
})

test("findings print grouped by plugin, then code, then name", () => {
    assert.deepEqual(
        findingLines([
            { plugin: "web", code: "RECORD_TYPE_AGENT", at: "nivo-web-core.x.y" },
            { plugin: "core", code: "RECORD_TYPE_NAME_FORMAT", at: "sales.order" },
            { plugin: "core", code: "RECORD_REF_OTHER_AGENT", at: "a.b.c.relations.d", detail: "a.e.f" },
        ]),
        [
            "  core  RECORD_REF_OTHER_AGENT  a.b.c.relations.d  (a.e.f)",
            "  core  RECORD_TYPE_NAME_FORMAT  sales.order",
            "  web  RECORD_TYPE_AGENT  nivo-web-core.x.y",
        ],
    )
})

test("the manifest drifts only when its JSON differs; the DDL when its bytes differ (CRLF read as LF)", () => {
    const manifest = '{\n  "version": 1,\n  "entities": []\n}\n'
    const ddl = "-- x\nCREATE TABLE a;\n"
    assert.equal(sameJson('{"version":1,"entities":[]}', manifest), true)
    assert.deepEqual(ddlDrift({ manifestText: '{"version":1,"entities":[]}', ddlText: ddl.replaceAll("\n", "\r\n") }, { manifest, ddl }), [])
    assert.deepEqual(ddlDrift({ manifestText: null, ddlText: "-- y\n" }, { manifest, ddl }), ["db/entities.manifest.json", "db/entities.ddl.sql"])
})

test("the manifest delta names the types added and dropped", () => {
    const of = (...names) => JSON.stringify({ version: 1, entities: names.map((entity) => ({ entity })) })
    assert.deepEqual(manifestDelta(of("a.b.c", "x.y"), of("a.b.c", "blocks-core.sales.settings")), {
        added: ["blocks-core.sales.settings"],
        dropped: ["x.y"],
    })
})
