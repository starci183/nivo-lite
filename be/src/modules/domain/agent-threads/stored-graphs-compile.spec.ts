import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { graphSpecSchema } from "@nivo-lite/agent-sdk/graph"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { INSTALLED as INSTALLATION } from "@modules/domain/installed-plugins"
import { coreTemplates } from "@modules/domain/installed-plugins/installed-plugins.testing"
import { templateStepIds } from "./template-steps.policy"
import { compileTemplate } from "./template-compiler.policy"
import type { TemplatePin } from "./template-compiler.policy"

// Package T (phase 3): threads are the one engine, so EVERY kind of stored graph must compile the way `ThreadGraphsService.routed`
// compiles it at run time (installed = the runnable steps, loops on): every version of every blocks-core workflow template (what the
// adopted workflows pin), every graph the seed publishes as an agent's own `<module>.main` flow, and graphs an owner draws in the editor
// (a for-each included). A refusal here would be a loud per-run stop on dev; the read-only proof over the dev database's stored
// versions is in the T output of the requests file (25 of 25 compiled on 2026-11-11).

/** Where the seed keeps the graph files it publishes as each agent's own flow, from this folder. */
const SEEDS_DIR = join(__dirname, "../../../../../.starcistacks/dev/seeds/data/graphs")

/** What the engine compiles against at run time: the control nodes, the engine's own steps of a @2 graph and every template node. */
// Built exactly as `ThreadGraphsService.routed` builds it (the `defineNode` nodes and `templateStepIds()`), so it cannot drift from the
// engine: the spec helper `runnableStepIds` it replaces had drifted (it lacked `core.hand-back`, so every graph with a hand-back step was
// reported TEMPLATE_STEP_UNKNOWN here while the engine runs it).
const INSTALLED: ReadonlySet<string> = new Set([...INSTALLATION.nodeInstall().nodes.map((node) => node.id), ...templateStepIds()])

/** The core package's workflow templates (since the flip, its template agents' graphs), as `WORKFLOW_TEMPLATES` listed them. */
const CORE_TEMPLATES = coreTemplates()

const pinOf = (versionId: string): TemplatePin => ({
    versionId,
    workflowId: null,
    number: 0,
    documentHash: null,
    templateId: null,
    templateVersion: null,
})

/** The problems of a graph compiled as the thread engine compiles it at run time; none for a graph that runs. */
const problemsOf = (versionId: string, spec: GraphSpec): ReadonlyArray<unknown> => {
    const compiled = compileTemplate({ pin: pinOf(versionId), spec }, INSTALLED, { loops: true })
    return compiled.kind === "refused" ? compiled.problems : []
}

const TEMPLATE_VERSIONS = CORE_TEMPLATES.flatMap((template) =>
    template.versions.map((version) => ({ name: `${template.id}@${String(version.version)}`, graph: version.graph })),
)

const SEEDED = readdirSync(SEEDS_DIR)
    .filter((file) => file.endsWith(".json"))
    .toSorted()
    .map((file) => ({ name: file, graph: graphSpecSchema.parse(JSON.parse(readFileSync(join(SEEDS_DIR, file), "utf8"))) }))

/** An owner-drawn workflow: a list read, a for-each whose body answers each element, a branch, and a hand-off. */
const OWNER_DRAWN: GraphSpec = graphSpecSchema.parse({
    schema: "nivo/agent-graph@1",
    moduleKey: "sales",
    trigger: { kind: "tag", sources: ["channel"] },
    grant: { tools: [], effects: [] },
    nodes: [
        { key: "each", kind: "execute", step: "core.for-each", routes: { body: "answer" }, next: "done" },
        { key: "answer", kind: "execute", step: "core.outcome" },
        { key: "done", kind: "output", step: "stop" },
    ],
})

describe("every stored graph kind compiles on threads, as the engine compiles it at run time", () => {
    it("finds the templates and the two seeded agent graphs (the accounting agent was dropped)", () => {
        expect(CORE_TEMPLATES.length).toBeGreaterThan(0)
        expect(TEMPLATE_VERSIONS.length).toBeGreaterThanOrEqual(CORE_TEMPLATES.length)
        expect(SEEDED.map((one) => one.name)).toEqual(["chatbot.json", "sales.json"])
    })

    it.each(TEMPLATE_VERSIONS)("compiles the template version $name", ({ name, graph }) => {
        expect(problemsOf(name, graph)).toEqual([])
    })

    it.each(SEEDED)("compiles the seeded agent graph $name (an agent's own <module>.main flow)", ({ name, graph }) => {
        expect(problemsOf(name, graph)).toEqual([])
    })

    it("compiles an owner-drawn graph with a for-each (the loop runs as a sequential cycle)", () => {
        expect(problemsOf("owner-drawn", OWNER_DRAWN)).toEqual([])
    })
})
