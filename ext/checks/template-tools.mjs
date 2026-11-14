#!/usr/bin/env node
// ext/manifest.json check `template-tools` (doc ext/docs/checks/template-tools.md): a template lists only the tools that act outside or on other
// people; the two default sets (`DEFAULT_NODE_TOOLS`, `DEFAULT_AI_READ_TOOLS` of @nivo-lite/agent-sdk/names) are never listed, except the AI reads a
// node's own code calls or requires (.starciwork/concepts/nivo-toolset.md). No arguments; exit 0 green, 1 with one line per offence
// `plugin  module  agent/node  tool`. It BUILDS FIRST (`npm run build:modules`, turbo-cached): the declarations are read from the built packages.
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { join } from "node:path"
import { countsByPlugin, defaultToolFindings, findingLines, listsOfPlugin } from "../support/template-tools-rules.mjs"
import { ROOT, buildModules } from "../support/program.mjs"

/** The core package and the export its plugin is (`corePlugin`); every other plugin exports `plugin` (scripts/build-plugin-registry.mjs). */
const CORE = { name: "@nivo-lite/blocks-core", exportName: "corePlugin" }

const built = buildModules()
if (built !== 0) {
    console.error("template tools: the packages do not build, so the declarations cannot be read (see the build output above)")
    process.exit(built)
}

const require = createRequire(join(ROOT, "package.json"))
const rootManifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"))
const packages = [CORE, ...(rootManifest.nivo?.plugins ?? []).map((name) => ({ name, exportName: "plugin" }))]
const plugins = packages.map(({ name, exportName }) => require(name)[exportName])
const { DEFAULT_AI_READ_TOOLS, DEFAULT_NODE_TOOLS } = require("@nivo-lite/agent-sdk/names")

const lists = plugins.flatMap((plugin) => listsOfPlugin(plugin))
const findings = defaultToolFindings(lists, { aiReadTools: DEFAULT_AI_READ_TOOLS, nodeTools: DEFAULT_NODE_TOOLS })
if (findings.length === 0) {
    console.log(`template tools: ${lists.length} tool lists of ${plugins.length} plugins name no default tool outside the exception (an AI read the node's code calls or requires)`)
    process.exit(0)
}
console.error(`template tools: ${findings.length} default tool(s) listed (${countsByPlugin(findings)}); defaults are never listed, remove them (plugin  module  agent/node  tool):`)
for (const line of findingLines(findings)) console.error(line)
process.exit(1)
