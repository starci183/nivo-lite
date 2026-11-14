#!/usr/bin/env node
// The generated artefacts of the record type declarations (.starciwork/concepts/records.md), rendered from the BUILT packages with no
// database: `db/entities.manifest.json` (the names the harness drift gate compares; the same text `cli entities plan --write` writes) and
// `db/entities.ddl.sql` (the DDL a fresh database gets for the partitions of public.records: the planner's own steps against a fresh catalog,
// `entitiesDdlOf` of @nivo-lite/agent-sdk/entity; what the build window's baseline carries). All SQL text comes from the SDK's planner and
// renderer, never from here.
//
//   npm run records:ddl      (= node scripts/records-ddl.mjs --write) writes both files; run `npm run build:modules` first
//   npm run records:check    (= --check) renders in memory and fails on any difference: the manifest compared as JSON, the DDL byte for byte
//
// The installed declarations are the plugin registry's (`installed.entities` of packages/plugin-registry/dist), the same list the be serves.
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { ddlDrift, manifestDelta } from "../ext/support/record-checks-rules.mjs"

const root = path.resolve(import.meta.dirname, "..")
const require = createRequire(path.join(root, "package.json"))
const MANIFEST = path.join("db", "entities.manifest.json")
const DDL = path.join("db", "entities.ddl.sql")

const { installed } = require(path.join(root, "packages", "plugin-registry", "dist", "index.js"))
const { entitiesDdlOf, manifestOf } = require(path.join(root, "packages", "agent-sdk", "dist", "entity", "index.js"))

const entities = installed.entities
const manifest = `${JSON.stringify(manifestOf(entities), null, 2)}\n`
const ddl = entitiesDdlOf(entities)

const readOrNull = (file) => {
    const full = path.join(root, file)
    return fs.existsSync(full) ? fs.readFileSync(full, "utf8") : null
}

if (process.argv.includes("--write")) {
    fs.writeFileSync(path.join(root, MANIFEST), manifest, "utf8")
    fs.writeFileSync(path.join(root, DDL), ddl, "utf8")
    console.log(`records ddl: wrote ${MANIFEST} and ${DDL} (${entities.length} record types)`)
    process.exit(0)
}

if (!process.argv.includes("--check")) {
    console.error("usage: node scripts/records-ddl.mjs --write | --check")
    process.exit(2)
}

const committed = { manifestText: readOrNull(MANIFEST), ddlText: readOrNull(DDL) }
const drift = ddlDrift(committed, { manifest, ddl })
if (drift.length === 0) {
    console.log(`records ddl: ${MANIFEST} and ${DDL} equal what the ${entities.length} declared record types render`)
    process.exit(0)
}
console.error(`records ddl: out of date: ${drift.join(", ")}`)
const delta = manifestDelta(committed.manifestText, manifest)
if (delta.added.length > 0) console.error(`  declared, not in the manifest: ${delta.added.join(", ")}`)
if (delta.dropped.length > 0) console.error(`  in the manifest, no longer declared: ${delta.dropped.join(", ")}`)
console.error("  regenerate: npm run build:modules && npm run records:ddl   (then review the diff)")
process.exit(1)
