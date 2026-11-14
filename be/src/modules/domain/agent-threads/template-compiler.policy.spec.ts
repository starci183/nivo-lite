import { Test } from "@nestjs/testing"
import type { GraphSpec, GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import { latestTemplateVersion } from "@nivo-lite/agent-sdk/template"
import { INSTALLED as INSTALLATION } from "@modules/domain/installed-plugins"
import { coreTemplates } from "@modules/domain/installed-plugins/installed-plugins.testing"
import { templateStepIds } from "./template-steps.policy"
import { THREAD_END } from "@modules/integrations/langgraph/langgraph.port"
import { FREEZE_NODE, compileTemplate, stepExitOf } from "./template-compiler.policy"
import type { CompiledTemplate, CompiledStep, TemplatePin, TemplateProblem } from "./template-compiler.policy"

const SUBJECT = Symbol("template-compiler.policy")

interface Subject {
    readonly compileTemplate: typeof compileTemplate
    readonly stepExitOf: typeof stepExitOf
}

/** One version to compile in a spec: the graph and the pin it is compiled under. */
interface Sample {
    readonly spec: GraphSpec
    readonly pin: TemplatePin
}

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { compileTemplate, stepExitOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

/** Every step id a version may run, as the thread engine hands them to the compiler (the control nodes and every template step). */
// Built exactly as `ThreadGraphsService.routed` builds it (the `defineNode` nodes and `templateStepIds()`), so it cannot drift from the
// engine: the spec helper `runnableStepIds` it replaces had drifted (it lacked `core.hand-back`, so every graph with a hand-back step was
// reported TEMPLATE_STEP_UNKNOWN here while the engine runs it).
const INSTALLED: ReadonlySet<string> = new Set([...INSTALLATION.nodeInstall().nodes.map((node) => node.id), ...templateStepIds()])

/** The core package's workflow templates: since the flip, one per graph of its template agents (`WORKFLOW_TEMPLATES` before). */
const WORKFLOW_TEMPLATES = coreTemplates()

/**
 * What each blocks-core template still cannot run on threads, by template id. Every template compiles today: none uses a for-each
 * (phase 2) and every step id is installed. A template that gains one must be listed here with its phase, never dropped in silence.
 * (`accounting.reconcile` and `accounting.reports` left with the money, owner decision wave 4; the booking, content, hiring, video and
 * `sales.payment` templates joined the catalogue; `sales.payment`, `content.plan` and `video.produce` draw a for-each, a gap of phase 2 listed
 * below, the others compile with none. `sales.payment-reminder` left: its reminders are the pay loop of the one sale graph, R47.)
 */
const NOT_YET_SUPPORTED: Readonly<Record<string, ReadonlyArray<TemplateProblem>>> = {
    "chatbot.front-desk": [],
    "sales.after-sale": [],
    "sales.consult": [],
    "sales.delivery-check": [],
    "sales.occasion": [],
    "sales.web-order": [],
    "chatbot.team-chat": [],
    "sales.team-chat": [],
    "sales.payment": [{ code: "TEMPLATE_LOOP_PHASE_2", at: "match" }],
    "booking.book": [],
    "booking.remind": [],
    "content.draft": [],
    "content.plan": [{ code: "TEMPLATE_LOOP_PHASE_2", at: "posts" }],
    "content.report": [],
    "hiring.digest": [],
    "hiring.screen": [],
    "video.produce": [{ code: "TEMPLATE_LOOP_PHASE_2", at: "scenes" }],
}

const pinOf = (templateId: string, templateVersion: number): TemplatePin => ({
    versionId: `version-${templateId}-${templateVersion}`,
    workflowId: null,
    number: templateVersion,
    documentHash: null,
    templateId,
    templateVersion,
})

const VERSIONS = WORKFLOW_TEMPLATES.flatMap((template) =>
    template.versions.map((version) => [`${template.id} v${version.version}`, template.id, version] as const),
)

/** The versions that draw no for-each: the ones that compile whole (a for-each is the listed phase-2 gap). */
const WHOLE_VERSIONS = VERSIONS.filter(([, , version]) => version.graph.nodes.every((node) => node.step !== "core.for-each"))

/** The newest chatbot.front-desk, the workflow phase 0 runs (one sample, so `it.each` over it never needs a null check). */
const FRONT_DESK: ReadonlyArray<Sample> = WORKFLOW_TEMPLATES.filter((template) => template.id === "chatbot.front-desk").map(
    (template) => {
        const version = latestTemplateVersion(template)
        return { spec: version.graph, pin: pinOf(template.id, version.version) }
    },
)

const withNodes = (spec: GraphSpec, nodes: ReadonlyArray<GraphSpecNode>): GraphSpec => ({ ...spec, nodes })

const compiled = (subject: Subject, sample: Sample): CompiledTemplate | null => {
    const result = subject.compileTemplate(sample, INSTALLED)
    return result.kind === "compiled" ? result.graph : null
}

const problemsOf = (subject: Subject, sample: Sample, installed: ReadonlySet<string> = INSTALLED) => {
    const result = subject.compileTemplate(sample, installed)
    return result.kind === "refused" ? result.problems : []
}

const nodeNamed = (graph: CompiledTemplate | null, name: string): CompiledStep | undefined =>
    graph?.nodes.find((candidate) => candidate.key === name)

describe("compileTemplate on every blocks-core template", () => {
    it("lists every template, and front-desk once", () => {
        expect(WORKFLOW_TEMPLATES.map((template) => template.id).sort()).toEqual(Object.keys(NOT_YET_SUPPORTED).sort())
        expect(FRONT_DESK).toHaveLength(1)
    })

    it.each(VERSIONS)("compiles %s, with only the listed gaps", async (_label, templateId, version) => {
        const subject = await build()

        expect(problemsOf(subject, { pin: pinOf(templateId, version.version), spec: version.graph })).toEqual(
            NOT_YET_SUPPORTED[templateId],
        )
    })

    it.each(WHOLE_VERSIONS)("compiles %s the same with for-each cycles on: it draws no for-each", async (_label, templateId, version) => {
        const subject = await build()
        const source = { pin: pinOf(templateId, version.version), spec: version.graph }

        expect(version.graph.nodes.filter((node) => node.step === "core.for-each")).toEqual([])
        expect(subject.compileTemplate(source, INSTALLED, { loops: true })).toEqual(subject.compileTemplate(source, INSTALLED))
    })

    it.each(WHOLE_VERSIONS)("keeps every route of %s inside the graph and pins the version", async (_label, templateId, version) => {
        const subject = await build()
        const pin = pinOf(templateId, version.version)

        const graph = compiled(subject, { pin, spec: version.graph })
        const steps = graph?.nodes ?? []
        const names = new Set([...steps.map((node) => node.key), FREEZE_NODE, THREAD_END])

        expect(graph?.pin).toEqual(pin)
        expect(graph?.entry).toBe(version.graph.nodes[0]?.key)
        expect(steps.flatMap((node) => node.ends).filter((end) => !names.has(end))).toEqual([])
        expect(steps.every((node) => node.ends.includes(FREEZE_NODE))).toBe(true)
        expect(graph?.freeze.ends).toEqual([...steps.map((node) => node.key), FREEZE_NODE, THREAD_END])
    })

    it.each(FRONT_DESK)("compiles front-desk to the four routes of understand and an end after each hand-off", async (sample) => {
        const subject = await build()

        const graph = compiled(subject, sample)

        // The first step is the chatbot's own `hear` (one trigger pipeline: what a package wants beyond the delivered event it does in its
        // graph's first node): it goes on to `understand`, or ends with `nothing` for an event with nothing to answer.
        expect(graph?.entry).toBe("hear")
        expect(nodeNamed(graph, "hear")?.exit).toMatchObject({
            kind: "branch",
            routes: { go: "understand", nothing: "nothing-to-answer" },
            otherwise: THREAD_END,
        })
        expect(nodeNamed(graph, "understand")?.exit).toEqual({
            kind: "branch",
            field: "branch",
            // The flip split the complaint step in two (reply to the customer, then tell the team): the route reaches the reply.
            routes: { buy: "to-consult", paid: "to-payment", book: "to-booking", complaint: "complaint-reply", question: "answer" },
            otherwise: THREAD_END,
        })
        expect(nodeNamed(graph, "to-consult")?.exit).toEqual({ kind: "next", to: THREAD_END })
        // A declined send is a decision (the owner's rule of 2026-11-12). R68 moved the design (G-SLIM, front desk v26): the hand-made
        // `complaint-declined` check + its notice are gone; the reply declares `unsuccessful: { then: "end", outcome: "declined" }`, so the
        // ENGINE tells the team and the outcome `declined` is one of the reply's own routes beside its `next` (E-FIX7).
        expect(nodeNamed(graph, "complaint-reply")?.exit).toEqual({ kind: "next", to: "complaint-notify" })
        expect(nodeNamed(graph, "complaint-reply")?.ends).toEqual(["complaint-notify", "declined", FREEZE_NODE])
        expect(nodeNamed(graph, "complaint-declined")).toBeUndefined()
        expect(nodeNamed(graph, "declined")?.step).toBe("core.outcome")
        expect(nodeNamed(graph, "complaint-notify")?.ends).toEqual(["to-owner", FREEZE_NODE])
        expect(nodeNamed(graph, "to-owner")?.step).toBe("core.outcome")
    })

    it.each(WORKFLOW_TEMPLATES.map((template) => template.id))("compiles the newest version of %s on threads", async (name) => {
        const subject = await build()
        const template = WORKFLOW_TEMPLATES.find((candidate) => candidate.id === name)
        const version = template === undefined ? null : latestTemplateVersion(template)

        const problems =
            version === null ? "no template" : problemsOf(subject, { pin: pinOf(name, version.version), spec: version.graph })

        expect(problems).toEqual(NOT_YET_SUPPORTED[name])
    })

    it.each(FRONT_DESK)("gives the same description for the same version", async (sample) => {
        const subject = await build()

        expect(compiled(subject, sample)).toEqual(compiled(subject, sample))
    })
})

describe("compileTemplate refusals", () => {
    it.each(FRONT_DESK)("refuses a step id that is not installed, by name", async ({ spec, pin }) => {
        const subject = await build()
        const installed = new Set([...INSTALLED].filter((id) => id !== "chatbot.answer"))

        expect(subject.compileTemplate({ pin, spec }, installed)).toEqual({
            kind: "refused",
            pin,
            problems: [{ code: "TEMPLATE_STEP_UNKNOWN", at: "answer" }],
        })
    })

    it.each(FRONT_DESK)("refuses a for-each as phase 2 instead of dropping it", async ({ spec, pin }) => {
        const subject = await build()
        const loop: GraphSpecNode = { key: "each", kind: "execute", step: "core.for-each", routes: { body: "answer" } }
        const nodes = spec.nodes.map((node) =>
            node.key === "understand" ? { ...node, routes: { ...node.routes, many: "each" } } : node,
        )

        expect(problemsOf(subject, { pin, spec: withNodes(spec, [...nodes, loop]) })).toEqual([
            { code: "TEMPLATE_LOOP_PHASE_2", at: "each" },
        ])
    })

    it.each(FRONT_DESK)("refuses keys that LangGraph or the engine keep for themselves", async ({ spec, pin }) => {
        const subject = await build()
        const keys = ["steps", FREEZE_NODE, "a:b", "a|b"]
        const extra = keys.map((key): GraphSpecNode => ({ key, kind: "output", step: "chatbot.answer" }))
        const nodes = spec.nodes.map((node) => (node.key === "answer" ? { ...node, next: "steps" } : node))

        expect(problemsOf(subject, { pin, spec: withNodes(spec, [...nodes, ...extra]) })).toEqual(
            keys.map((at) => ({ code: "TEMPLATE_KEY_RESERVED", at })),
        )
    })

    it.each(FRONT_DESK)("refuses a duplicate key, an edge to nowhere and an empty graph", async ({ spec, pin }) => {
        const subject = await build()
        const nodes = spec.nodes.map((node) => (node.key === "answer" ? { ...node, next: "gone" } : node))
        const twins = spec.nodes.filter((node) => node.key === "to-owner")

        expect(problemsOf(subject, { pin, spec: withNodes(spec, [...nodes, ...twins]) })).toEqual([
            { code: "TEMPLATE_KEY_DUPLICATE", at: "to-owner" },
            { code: "TEMPLATE_TARGET_UNKNOWN", at: "answer->gone" },
        ])
        expect(problemsOf(subject, { pin, spec: withNodes(spec, []) })).toEqual([{ code: "TEMPLATE_EMPTY", at: "chatbot" }])
    })

    it.each(FRONT_DESK)("turns an edge to a stop node into the end and leaves the stop out", async ({ spec, pin }) => {
        const subject = await build()
        const stop: GraphSpecNode = { key: "halt", kind: "output", step: "stop" }
        const nodes = spec.nodes.map((node) => (node.key === "answer" ? { ...node, next: "halt" } : node))

        const graph = compiled(subject, { pin, spec: withNodes(spec, [...nodes, stop]) })

        expect(nodeNamed(graph, "answer")?.exit).toEqual({ kind: "next", to: THREAD_END })
        expect(graph?.nodes.map((node) => node.key)).not.toContain("halt")
    })
})

describe("stepExitOf", () => {
    it.each(FRONT_DESK)("follows the output's branch, and ends on a branch with no route or no branch", async (sample) => {
        const subject = await build()
        const graph = compiled(subject, sample)
        const exitOf = (name: string, output: unknown) => {
            const node = nodeNamed(graph, name)
            return node === undefined ? `missing ${name}` : subject.stepExitOf(node, output)
        }

        expect(exitOf("understand", { branch: "paid", summary: "x" })).toBe("to-payment")
        expect(exitOf("understand", { branch: "elsewhere" })).toBe(THREAD_END)
        expect(exitOf("understand", null)).toBe(THREAD_END)
        // R68 moved the design (G-SLIM, front desk v26): the `*-declined` checks are gone; a completed reply / answer follows its own exit
        // (a declined one goes to `declined` by the engine's ending, never by the output's branch: `step-endings` world covers that road).
        expect(exitOf("complaint-reply", { summary: "x" })).toBe("complaint-notify")
        expect(exitOf("complaint-notify", { summary: "x" })).toBe("to-owner")
        expect(exitOf("answer", {})).toBe(THREAD_END)
    })
})
