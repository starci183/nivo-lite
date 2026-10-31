import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import { AMOUNT_FACT, FACTS, contextOf, say } from "@tests/fixtures/builders/agent-graph.builder"
import type { SeedAction, SeedModule, SeedRule, SeedTemplate } from "../agent-graphs.seed"
import { baseGraphOf } from "./base-graph.policy"
import { graphProblems } from "./graph-problems.policy"

/** The members of the subject under test. */
interface Subject {
    readonly baseGraphOf: typeof baseGraphOf
}

const SUBJECT = Symbol("base-graph.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { baseGraphOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const VOICE = { locale: "en", say } as const

const actionOf = builder<SeedAction>({
    action: "pay_supplier",
    label: { vi: "Pay", en: "Pay a supplier" },
    mode: "ask",
    amountLimit: true,
    maxMode: null,
    graphFacts: [AMOUNT_FACT],
})

const moduleOf = builder<SeedModule>({
    key: "accounting",
    name: { vi: "Accounting", en: "Accounting" },
    connectionProviders: ["sepay", "unknown"],
    authorityActions: [actionOf()],
})

const templateOf = builder<SeedTemplate>({
    key: "payment-reminder",
    version: 2,
    executor: "implemented",
    name: { vi: "Reminder", en: "Payment reminder" },
    trigger: { kind: "schedule", line: { vi: "Daily", en: "Every morning" } },
    authority: { action: null },
})

const ruleOf = builder<SeedRule>({
    action: "pay_supplier",
    mode: "auto",
    unit: "vnd",
    limit_vnd: null,
    auto_max: 5_000_000,
    ask_max: 20_000_000,
    approver_roles: ["manager"],
    approver_rooms: [],
    approver_members: ["dinh"],
    approval_policy: "any",
    timeout_minutes: 240,
})

const keysOf = (graph: ReturnType<typeof baseGraphOf>): ReadonlyArray<string> => graph.nodes.map((node) => node.key)

describe("base-graph.policy", () => {
    it("derives a decide point, an approval, an act and a stop for an action with an amount limit", async () => {
        const subject = await build()

        const graph = subject.baseGraphOf(moduleOf(), [], [ruleOf()], VOICE)

        expect(keysOf(graph)).toEqual(["start", "tag", "understand", "decide:pay_supplier", "ask:pay_supplier", "act:pay_supplier", "stop:pay_supplier", "end"])
        expect(graph.nodes.find((node) => node.key === "decide:pay_supplier")?.decide?.facts).toEqual([AMOUNT_FACT])
        expect(graph.nodes.find((node) => node.key === "ask:pay_supplier")?.approver?.group.members).toEqual(["dinh"])
        expect(graph.rights).toEqual([])
    })

    it("leaves no node with a blank answer, no dead end and nothing the owner must fix", async () => {
        const subject = await build()

        const graph = subject.baseGraphOf(moduleOf(), [], [ruleOf()], VOICE)
        const problems = graphProblems(graph, contextOf({ facts: FACTS, ceilings: [{ action: "pay_supplier", mode: "auto", limitVnd: null, autoMax: 5_000_000, maxMode: null }] }))

        expect(problems).toEqual([])
    })

    it("writes the module and template names in the language of the workspace and clips a title to 28 characters", async () => {
        const subject = await build()

        const graph = subject.baseGraphOf(moduleOf(), [templateOf()], [ruleOf()], VOICE)

        expect(graph.nodes.find((node) => node.key === "start:payment-reminder")?.title).toBe("Every morning")
        expect(graph.nodes.find((node) => node.key === "pipeline:payment-reminder")?.title).toBe("Payment reminder")
        const long = subject.baseGraphOf(moduleOf({ authorityActions: [actionOf({ label: { vi: "x", en: "A supplier payment with a name far too long" } })] }), [], [ruleOf()], VOICE)
        expect(long.nodes.find((node) => node.key === "act:pay_supplier")?.title).toHaveLength(28)
    })

    it("maps a template the engine runs to an act node with a pipeline, and a template with only a definition to nothing", async () => {
        const subject = await build()

        const graph = subject.baseGraphOf(moduleOf(), [templateOf(), templateOf({ key: "later", executor: "definition" })], [ruleOf()], VOICE)

        expect(graph.nodes.find((node) => node.key === "pipeline:payment-reminder")).toMatchObject({
            kind: "output",
            step: "write",
            pipeline: "payment-reminder",
            doneBy: "nivo",
            sources: [{ kind: "template", key: "payment-reminder", version: 2 }],
        })
        expect(keysOf(graph)).not.toContain("pipeline:later")
        expect(keysOf(graph).filter((key) => key.startsWith("start:"))).toEqual(["start:payment-reminder", "start:later"])
    })

    it("adds an approval that cannot become auto for a template whose message always asks", async () => {
        const subject = await build()
        const template = templateOf({ authority: { action: "pay_supplier", alwaysAsk: true } })

        const graph = subject.baseGraphOf(moduleOf(), [template], [ruleOf()], VOICE)
        const always = graph.nodes.find((node) => node.key === "always:payment-reminder")

        expect(always).toMatchObject({ kind: "output", step: "approval", doneBy: "person" })
        expect(always?.approver?.group.members).toEqual(["dinh"])
        expect(keysOf(subject.baseGraphOf(moduleOf(), [templateOf()], [ruleOf()], VOICE))).not.toContain("always:payment-reminder")
    })

    it("rises with a template version, because the version is the source of the start node", async () => {
        const subject = await build()

        const low = subject.baseGraphOf(moduleOf(), [templateOf({ version: 1 })], [ruleOf()], VOICE)
        const high = subject.baseGraphOf(moduleOf(), [templateOf({ version: 2 })], [ruleOf()], VOICE)

        expect(low.nodes[0]?.sources).toEqual([{ kind: "template", key: "payment-reminder", version: 1 }])
        expect(high.nodes[0]?.sources).toEqual([{ kind: "template", key: "payment-reminder", version: 2 }])
    })

})

describe("base-graph.policy edge cases", () => {
    it("asks without a decide point for an action with no amount, a unit that is not dong or a cap, and runs alone only when the rule says so", async () => {
        const subject = await build()
        const plain = moduleOf({ authorityActions: [actionOf({ amountLimit: false })] })
        const percent = subject.baseGraphOf(moduleOf(), [], [ruleOf({ unit: "percent" })], VOICE)
        const capped = subject.baseGraphOf(moduleOf({ authorityActions: [actionOf({ maxMode: "ask" })] }), [], [ruleOf()], VOICE)
        const free = subject.baseGraphOf(plain, [], [ruleOf({ auto_max: null, ask_max: null })], VOICE)
        const never = subject.baseGraphOf(plain, [], [ruleOf({ mode: "never" })], VOICE)
        const norule = subject.baseGraphOf(plain, [], [], VOICE)
        const ask = subject.baseGraphOf(plain, [], [ruleOf({ mode: "ask", auto_max: null, ask_max: null })], VOICE)

        expect(keysOf(percent)).toContain("ask:pay_supplier")
        expect(keysOf(percent)).not.toContain("decide:pay_supplier")
        expect(keysOf(capped)).not.toContain("decide:pay_supplier")
        expect(keysOf(free)).toEqual(["start", "tag", "understand", "act:pay_supplier", "end"])
        expect(keysOf(never)).toEqual(["start", "tag", "understand", "stop:pay_supplier", "end"])
        expect(keysOf(norule)).toContain("ask:pay_supplier")
        expect(keysOf(ask)).toContain("ask:pay_supplier")
    })

    it("starts at triggers only: a customer message, the tag of the agent and each template schedule, and every path ends at an output", async () => {
        const subject = await build()

        const graph = subject.baseGraphOf(moduleOf(), [templateOf()], [ruleOf()], VOICE)

        expect(graph.nodes.filter((node) => node.kind === "trigger").map((node) => [node.key, node.step])).toEqual([
            ["start:payment-reminder", "schedule"],
            ["tag", "tag"],
        ])
        expect(graph.nodes.filter((node) => node.kind === "output").map((node) => node.step)).toEqual(["approval", "write", "stop", "write", "stop"])
        expect(graph.nodes.find((node) => node.key === "understand")).toMatchObject({ kind: "execute", step: "call", doneBy: "agent" })
    })

    it("lists the providers the module can use on the understand node and ignores the ones it cannot name", async () => {
        const subject = await build()

        const graph = subject.baseGraphOf(moduleOf(), [], [ruleOf()], VOICE)

        expect(graph.nodes.find((node) => node.key === "understand")?.uses).toEqual([
            { provider: "sepay", tool: null, scope: "read", label: "sepay" },
        ])
    })

    it("falls back to the amount of the action when the module declares no fact", async () => {
        const subject = await build()
        const graph = subject.baseGraphOf(moduleOf({ authorityActions: [actionOf({ graphFacts: undefined })] }), [], [ruleOf()], VOICE)

        expect(graph.nodes.find((node) => node.key === "decide:pay_supplier")?.decide?.facts).toEqual(["pay_supplier.amount_vnd"])
    })
})
