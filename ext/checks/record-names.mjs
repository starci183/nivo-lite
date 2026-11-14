#!/usr/bin/env node
// ext/manifest.json check `record-names` (doc ext/docs/checks/record-names.md): the records frame's name law over every installed record type
// and record read (.starciwork/concepts/records.md): a type is `<package>.<agent>.<domain>` and a read that reaches records
// `<package>.<agent>.api.<domain>.<query>`, `<package>` the declaring plugin's `packageName` (equal to its package.json name without the
// scope) and `<agent>` a template agent that plugin declares; a ref and a read reach only types of their own agent. Every record type
// follows it (the engine's own bookkeeping is core tables, never records). No arguments; exit 0 green, 1 with every offender listed by its plugin.
// It BUILDS FIRST (`npm run build:modules`, turbo-cached): the law and the declarations are read from the built packages.
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { join } from "node:path"
import { findingLines, packageNameFindings } from "../support/record-checks-rules.mjs"
import { ROOT, buildModules } from "../support/program.mjs"

/** The core package and the export its plugin is (`corePlugin`); every other plugin exports `plugin` (scripts/build-plugin-registry.mjs). */
const CORE = { name: "@nivo-lite/blocks-core", exportName: "corePlugin" }

const built = buildModules()
if (built !== 0) {
    console.error("record names: the packages do not build, so the declarations cannot be read (see the build output above)")
    process.exit(built)
}

const require = createRequire(join(ROOT, "package.json"))
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"))
const rootManifest = readJson(join(ROOT, "package.json"))
const packages = [CORE, ...(rootManifest.nivo?.plugins ?? []).map((name) => ({ name, exportName: "plugin" }))]
const loaded = packages.map(({ name, exportName }) => ({
    packageJsonName: readJson(join(ROOT, "node_modules", ...name.split("/"), "package.json")).name,
    plugin: require(name)[exportName],
}))
const { recordLawProblems } = require("@nivo-lite/agent-sdk/installation")

const findings = [...packageNameFindings(loaded), ...recordLawProblems(loaded.map((one) => one.plugin))]
const types = loaded.reduce((count, one) => count + (one.plugin?.entities?.length ?? 0), 0)
if (findings.length === 0) {
    console.log(`record names: ${types} record types and their reads follow <package>.<agent>.<domain> (${loaded.length} plugins)`)
    process.exit(0)
}
console.error(`record names: ${findings.length} offences of the records frame's name law (plugin  code  name), owners rename their own:`)
for (const line of findingLines(findings)) console.error(line)
process.exit(1)
