// Writes the agent graph files of the dev seed (.starcistacks/dev/seeds/data/graphs/<module>.json) as the newest version of the PRIMARY
// workflow template of each module, read from the built blocks-core (`npm run build -w @nivo-lite/blocks-core` first).
// `npm run seeds:graphs` writes the stale ones; `npm run seeds:graphs -- --check` fails when one is out of date. `reset-workflows` and the
// seed read these files, and agent-graph-flow-runs.service.spec.ts pins them to the templates: run this after any template change.
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"

const require = createRequire(path.resolve("be", "package-anchor.js"))
const { WORKFLOW_TEMPLATES, latestTemplateVersion } = require("@nivo-lite/blocks-core/modules")

const GRAPHS = path.join(".starcistacks", "dev", "seeds", "data", "graphs")
const check = process.argv.includes("--check")

const stale = []
for (const file of fs.readdirSync(GRAPHS).filter((name) => name.endsWith(".json")).sort()) {
    const moduleKey = file.slice(0, -".json".length)
    const primary = WORKFLOW_TEMPLATES.find((template) => template.moduleKey === moduleKey && template.primary)
    if (primary === undefined) {
        console.error(`${file}: no primary workflow template of module ${moduleKey}`)
        process.exitCode = 1
        continue
    }
    const target = path.join(GRAPHS, file)
    const graph = latestTemplateVersion(primary).graph
    if (JSON.stringify(JSON.parse(fs.readFileSync(target, "utf8"))) === JSON.stringify(graph)) continue
    stale.push(file)
    if (!check) fs.writeFileSync(target, `${JSON.stringify(graph, null, 4)}\n`)
}

if (stale.length === 0) console.log("seed graphs: up to date")
else if (check) {
    console.error(`seed graphs out of date: ${stale.join(", ")} (run npm run seeds:graphs)`)
    process.exitCode = 1
} else console.log(`seed graphs written: ${stale.join(", ")}`)
