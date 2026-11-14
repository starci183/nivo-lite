// Writes the agent graph files of the dev seed (.starcistacks/dev/seeds/data/graphs/<module>.json) as the newest version of the PRIMARY
// workflow template of each module AS THE ENGINE INSTALLS IT: `INSTALLED.templates()` of the back end (be/src/modules/domain/installed-plugins),
// the one road every template takes into a workspace. A module's template agent (`templateAgents`, GraphSpec `@2`) reaches it through the
// adapter `installed-plugins/template-graph-adapter.policy.ts` (each graph a workflow template, the agent's `primary` the primary one);
// a legacy template (`templates`, `@1`), while one is installed, as it is. So a seed file is EXACTLY the graph installing the template agent
// publishes as the agent's primary workflow, computed by the same code (the back end's own source, loaded through ts-node), never hand-edited.
// Build the packages and regenerate the registry first (`npm run build:modules`, `node scripts/build-plugin-registry.mjs`).
// `npm run seeds:graphs` writes the stale ones; `npm run seeds:graphs -- --check` fails when one is out of date. Both end with a self-check:
// every file, read back through the SDK's graph schema exactly as the seed step reads it (`seed-agent-graphs`, `graph-seed.policy.ts`),
// must equal the installed primary graph of its module. `reset-workflows` and the seed read these files, and
// agent-graph-flow-runs.service.spec.ts pins them to the installed templates: run this after any template change.
import fs from "node:fs"
import path from "node:path"
import { isDeepStrictEqual } from "node:util"
import { createRequire } from "node:module"

const BE = path.resolve("be")
const require = createRequire(path.join(BE, "package-anchor.js"))
// The back end's source as the engine runs it: transpiled only (the types are the back end's own `tsc`'s), its path aliases resolved.
require("ts-node").register({
    project: path.join(BE, "tsconfig.json"),
    transpileOnly: true,
    compilerOptions: { module: "commonjs", moduleResolution: "node10" },
})
require("tsconfig-paths").register({ baseUrl: BE, paths: { "@modules/*": ["./src/modules/*"], "@features/*": ["./src/features/*"] } })
const { INSTALLED } = require(path.join(BE, "src", "modules", "domain", "installed-plugins", "index.ts"))
const { latestTemplateVersion } = require("@nivo-lite/agent-sdk/template")
const { graphSpecSchema } = require("@nivo-lite/agent-sdk/graph")

const GRAPHS = path.join(".starcistacks", "dev", "seeds", "data", "graphs")
const check = process.argv.includes("--check")

/** The graph installing the module's template agent publishes as its primary workflow, or null when the module has no primary template. */
const installedPrimaryOf = (moduleKey) => {
    const primaries = INSTALLED.templatesOf(moduleKey).filter((template) => template.primary)
    if (primaries.length !== 1) return null
    return latestTemplateVersion(primaries[0]).graph
}

const files = fs.readdirSync(GRAPHS).filter((name) => name.endsWith(".json")).sort()
const stale = []
for (const file of files) {
    const moduleKey = file.slice(0, -".json".length)
    const graph = installedPrimaryOf(moduleKey)
    if (graph === null) {
        console.error(`${file}: module ${moduleKey} has not exactly one installed primary template (template agent primary or legacy primary)`)
        process.exitCode = 1
        continue
    }
    const target = path.join(GRAPHS, file)
    if (JSON.stringify(JSON.parse(fs.readFileSync(target, "utf8"))) === JSON.stringify(graph)) continue
    stale.push(file)
    if (!check) fs.writeFileSync(target, `${JSON.stringify(graph, null, 4)}\n`)
}

if (stale.length === 0) console.log("seed graphs: up to date")
else if (check) {
    console.error(`seed graphs out of date: ${stale.join(", ")} (run npm run seeds:graphs)`)
    process.exitCode = 1
} else console.log(`seed graphs written: ${stale.join(", ")}`)

// The self-check: each file as the seed step reads it (the SDK's graph schema) is the installed primary graph of its module.
if (!(check && stale.length > 0)) {
    const wrong = files.filter((file) => {
        const graph = installedPrimaryOf(file.slice(0, -".json".length))
        const parsed = graphSpecSchema.safeParse(JSON.parse(fs.readFileSync(path.join(GRAPHS, file), "utf8")))
        return graph === null || !parsed.success || !isDeepStrictEqual(parsed.data, JSON.parse(JSON.stringify(graph)))
    })
    if (wrong.length > 0) {
        console.error(`seed graphs NOT the installed primary graph once read by the seed's schema: ${wrong.join(", ")}`)
        process.exitCode = 1
    } else console.log(`seed graphs: ${files.length} read by the seed's schema equal the installed primary graphs`)
}
