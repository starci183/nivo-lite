import { graphSpecProblems, triggerProblems } from "@nivo-lite/agent-sdk/graph"
import type { GraphSpec, GraphSpecV2, GraphV2Trigger, WorkflowTrigger } from "@nivo-lite/agent-sdk/graph"
import { nodeIndexOf } from "@nivo-lite/agent-sdk/node"
import { latestTemplateVersion } from "@nivo-lite/agent-sdk/template"
import { tagContextOf } from "@modules/domain/agent-work"
import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import { INSTALLED, graphOfSpecV2 } from "@modules/domain/installed-plugins"
import { PROVIDER_TRIGGER_TAG_SOURCE, providerTriggerLookup, wakeContextOf } from "@modules/domain/provider-triggers"
import type { ProviderWake } from "@modules/domain/provider-triggers"
import { tagSourceOf, triggerScopeOf } from "./graph-flow.policy"
import type { FlowWake } from "./graph-flow.policy"
import { flowProblemsOf, requireSoundFlow } from "./flow.policy"
import { workflowRouteOf } from "./workflow-route.policy"
import { providerTriggerOfWake, takingTriggerOf, triggerTakes } from "./workflow-trigger.policy"
import { TestWorldError, TestWorldErrorCode } from "@tests/world/test-world.error"

/** The part an agent has in an event. */
type TriggerRole = "decider" | "notice"

/** The wake the emit point writes for a bank movement, exactly as the tag door keeps it. */
const bankWake = (direction: "in" | "out", role: TriggerRole = "notice", connectionId = "conn-1"): FlowWake => {
    const wake: ProviderWake = {
        providerTrigger: "sepay:transaction.received",
        connectionId,
        // Ledger (ROAD Opus-1f, R44): the movement is the event's `data` (the generic scope of the one pipeline), not a top member.
        params: { data: { transactionId: "tx-1", direction } },
    }
    return {
        source: "tag",
        context: tagContextOf(
            {
                source: PROVIDER_TRIGGER_TAG_SOURCE,
                workspaceId: "ws-1",
                toAgentId: "agent-1",
                text: wake.providerTrigger,
                subject: "bank-transaction:tx-1",
            },
            JSON.stringify(wakeContextOf(wake, role)),
        ),
        actorMemberId: null,
    }
}

/**
 * The wake the bank feed's core path wrote for the bound accounting agent (`bank-feed-flow.service.ts`, deleted with the money strip): no
 * producer writes it any more, and the core bank road that took it left the registry (TOOLS-LEAD W2).
 */
const CORE_WAKE: FlowWake = {
    source: "tag",
    context: tagContextOf({
        source: "bank_feed",
        workspaceId: "ws-1",
        toAgentId: "accounting-1",
        text: "credit",
        subject: "bank-transaction:tx-1",
    }),
    actorMemberId: null,
}

const BANK_IN: WorkflowTrigger = {
    key: "bank",
    source: { kind: "provider", connectionId: null, provider: "sepay", trigger: "transaction.received" },
    conditions: [{ param: "data.direction", op: "equals", value: "in" }],
}
/** A stored @1 trigger of the retired core bank road's kind: still readable, served by no verb. */
const CORE_SEPAY: WorkflowTrigger = { key: "bank", source: { kind: "sepay", connectionId: null } }
const TIMER: WorkflowTrigger = { key: "care", source: { kind: "timer", connectionId: null } }

const takes = (trigger: WorkflowTrigger, wake: FlowWake): boolean =>
    triggerTakes(trigger, tagSourceOf(wake), triggerScopeOf(wake))

describe("a wake a provider trigger fired", () => {
    it("arrives as a system event that names its provider trigger, its account, the agent's part and the transaction", () => {
        const scope = triggerScopeOf(bankWake("in", "decider"))
        expect(tagSourceOf(bankWake("in"))).toBe("system-event")
        expect(providerTriggerOfWake(scope)).toBe("sepay:transaction.received")
        expect(scope).toMatchObject({ data: { transactionId: "tx-1", direction: "in" }, connectionId: "conn-1", role: "decider" })
    })

    it("is taken by a workflow registered on it whose filter holds, and not when the filter does not", () => {
        expect(takes(BANK_IN, bankWake("in"))).toBe(true)
        expect(takes(BANK_IN, bankWake("out"))).toBe(false)
    })

    it("is taken on the registered account only when the registration names one", () => {
        const onOne: WorkflowTrigger = { ...BANK_IN, source: { ...BANK_IN.source, connectionId: "conn-1" } }
        expect(takes(onOne, bankWake("in", "notice", "conn-1"))).toBe(true)
        expect(takes(onOne, bankWake("in", "notice", "conn-2"))).toBe(false)
    })

    it("is not taken by another provider's trigger, nor by a trigger of any other kind that wakes on system events", () => {
        const mail: WorkflowTrigger = {
            key: "mail",
            source: { kind: "provider", connectionId: null, provider: "imap", trigger: "mail.received" },
        }
        expect(takes(mail, bankWake("in"))).toBe(false)
        expect(takes(CORE_SEPAY, bankWake("in"))).toBe(false)
        expect(takes(TIMER, bankWake("in"))).toBe(false)
    })

    it("is not taken by a graph from before contracts, which registered on nothing", () => {
        const old = { trigger: { kind: "tag", sources: ["system-event"] }, triggers: undefined } as unknown as GraphSpec
        expect(takingTriggerOf(old, "system-event", triggerScopeOf(bankWake("in")))).toBeNull()
    })
})

// Ledger (TOOLS-LEAD W2): "the bank feed's core wake, unchanged" (taken by the core SePay trigger, its transaction from the subject) left
// with the core bank road; what stays true of that old wake is that it names no verb, so nothing takes it.
describe("the retired core bank road's wake", () => {
    it("names no verb: neither a stored trigger of its old kind nor a bank feed's registration takes it", () => {
        expect(takes(CORE_SEPAY, CORE_WAKE)).toBe(false)
        expect(takes(BANK_IN, CORE_WAKE)).toBe(false)
        expect(providerTriggerOfWake(triggerScopeOf(CORE_WAKE))).toBeNull()
    })
})

describe("the route of a provider wake", () => {
    it("goes to the workflow registered on it, among an agent's workflows that wake on system events", () => {
        const workflows = [
            { id: "main", status: "active" as const, primary: true, position: 0, sources: ["channel", "system-event"] },
            {
                id: "payment",
                status: "active" as const,
                primary: false,
                position: 1,
                sources: ["agent", "system-event"],
            },
        ]
        const triggersOf: Readonly<Record<string, ReadonlyArray<WorkflowTrigger>>> = {
            main: [TIMER],
            payment: [BANK_IN],
        }
        const wake = bankWake("in")
        const takers = workflows.filter((workflow) =>
            (triggersOf[workflow.id] ?? []).some((trigger) => takes(trigger, wake)),
        )
        expect(workflowRouteOf(takers, tagSourceOf(wake))).toBe("payment")
    })
})

describe("the plugin case: webbooks.payment registered on sepay:transaction.received", () => {
    // The template as the engine installs it: the plugin's `@2` graph read through the adapter (its verb's triggers DERIVED).
    const template = INSTALLED.templateOf("webbooks.payment")
    const graph = template === null ? undefined : latestTemplateVersion(template).graph
    const index = nodeIndexOf(INSTALLED.nodeInstall())
    /** The key of the derived registration on SePay's bank trigger. */
    const bankKey = graph?.triggers?.find(
        (trigger) =>
            trigger.source.kind === "provider" &&
            trigger.source.provider === "sepay" &&
            trigger.source.trigger === "transaction.received",
    )?.key

    it("ships a version that registers on the bank trigger, money in only", () => {
        // The plugin declares ONE verb, a credit received, on both bank feeds (the credit IS money in: no direction condition is
        // written). Ledger (owner key triggerOneSource2026_11_12, CORRECTED 2026-11-12: one source per STREAM): restored to both feeds
        // (`accounts: ["sepay", "casso"]`), which T1's single-account shape had cut to SePay's two roads. Ledger (TOOLS-LEAD W2): two
        // derived sources now, one provider trigger per feed (the core SePay road left the registry).
        expect(INSTALLED.templateGraphOf("webbooks.payment")?.graph.spec.triggers).toEqual([
            { verb: TRIGGER.paymentCreditReceived, accounts: ["sepay", "casso"] },
        ])
        expect(graph?.triggers?.map((trigger) => trigger.source.kind)).toEqual(["provider", "provider"])
        expect(bankKey).toBeDefined()
    })

    it("is sound against the installation AND the declared provider triggers, as a save judges it", () => {
        if (graph === undefined) throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { what: "webbooks.payment is not installed" } })
        expect(flowProblemsOf(graph, index)).toEqual([])
        expect(
            graphSpecProblems(graph, index, providerTriggerLookup).filter((problem) =>
                problem.code.startsWith("TRIGGER_"),
            ),
        ).toEqual([])
        expect(() => requireSoundFlow(graph, index)).not.toThrow()
    })

    it("is woken by a scripted bank credit as a notice receiver, and as the decider when the account is bound to it: same workflow, its part in the scope", () => {
        if (graph === undefined) throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { what: "webbooks.payment is not installed" } })
        const notice = bankWake("in", "notice")
        const decider = bankWake("in", "decider")
        expect(takingTriggerOf(graph, tagSourceOf(notice), triggerScopeOf(notice))).toBe(bankKey)
        expect(takingTriggerOf(graph, tagSourceOf(decider), triggerScopeOf(decider))).toBe(bankKey)
        expect(triggerScopeOf(notice).role).toBe("notice")
        expect(triggerScopeOf(decider).role).toBe("decider")
        expect(triggerScopeOf(decider).data).toMatchObject({ transactionId: "tx-1" })
    })

    it("is not woken by money that left the account, and takes no hand-off (no workflow calls it since the flip)", () => {
        if (graph === undefined) throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { what: "webbooks.payment is not installed" } })
        const out = bankWake("out")
        expect(takingTriggerOf(graph, tagSourceOf(out), triggerScopeOf(out))).toBeNull()
        expect(graph.triggers?.some((trigger) => trigger.source.kind === "workflow")).toBe(false)
        expect(graph.triggers?.some((trigger) => triggerTakes(trigger, "agent", {}))).toBe(false)
    })

    it("refuses a registration on a trigger no provider declares", () => {
        if (graph === undefined) throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { what: "webbooks.payment is not installed" } })
        const wrong: GraphSpec = {
            ...graph,
            triggers: (graph.triggers ?? []).map((trigger) =>
                trigger.key === bankKey
                    ? { ...trigger, source: { ...trigger.source, trigger: "refund.received" } }
                    : trigger,
            ),
        }
        // A graph read from a template graph is edited in its package, never in a save: the save refuses it as edited.
        expect(flowProblemsOf(wrong, index).map((problem) => problem.code)).toEqual(["GRAPH_V2_EDITED"])
        // And the provider trigger check names the unknown registration (whose wake supplies nothing of the contract, not even the
        // `direction` its credit condition reads).
        expect(
            graphSpecProblems(wrong, index, providerTriggerLookup)
                .map((problem) => problem.code)
                .filter((code) => code.startsWith("TRIGGER_")),
        ).toEqual(["TRIGGER_PROVIDER_UNKNOWN", "TRIGGER_INPUT_UNSUPPLIED", "TRIGGER_CONDITION_UNKNOWN"])
    })
})

describe("the credit verb's derived registrations keep money in only, on every bank road", () => {
    const graph = (() => {
        const template = INSTALLED.templateOf("webbooks.payment")
        return template === null ? undefined : latestTemplateVersion(template).graph
    })()

    it("carries `direction = in` on every bank feed's provider trigger", () => {
        if (graph === undefined) throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { what: "webbooks.payment is not installed" } })
        const byKind = (graph.triggers ?? []).map((trigger) => [
            trigger.source.kind,
            trigger.source.provider ?? null,
            trigger.conditions ?? [],
        ])
        // Ledger (owner key triggerOneSource2026_11_12, CORRECTED 2026-11-12): the shipped graph lists both feeds again, so its Casso
        // registration is back (T1 had dropped it); Casso's own narrowing is also proven below on the graph listing Casso alone.
        // Ledger (TOOLS-LEAD W2): the core road's row (no condition) and its wake's route left with the core bank road.
        expect(byKind).toEqual([
            ["provider", "sepay", [{ param: "data.direction", op: "equals", value: "in" }]],
            ["provider", "casso", [{ param: "data.direction", op: "equals", value: "in" }]],
        ])
        expect(takingTriggerOf(graph, tagSourceOf(CORE_WAKE), triggerScopeOf(CORE_WAKE))).toBeNull()
    })

    it("is not woken by a Casso debit either (the same graph bound to Casso: its one registration carries `direction = in`)", () => {
        const spec = INSTALLED.templateGraphOf("webbooks.payment")?.graph.spec
        if (spec === undefined) throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { what: "webbooks.payment is not installed" } })
        const onCasso: GraphSpecV2 = {
            ...spec,
            triggers: [{ verb: TRIGGER.paymentCreditReceived, accounts: ["casso"] }],
        }
        const graph = graphOfSpecV2(onCasso, {
            legacyNodeOf: (id) => INSTALLED.nodeInstall().nodes.find((node) => node.id === id),
            templateNodeOf: (id) => INSTALLED.templateNodeOf(id) ?? undefined,
        })
        expect(graph.triggers?.map((trigger) => [trigger.source.provider ?? null, trigger.conditions ?? []])).toEqual([
            ["casso", [{ param: "data.direction", op: "equals", value: "in" }]],
        ])
        const cassoWake = (direction: "in" | "out"): FlowWake => {
            const wake: ProviderWake = {
                providerTrigger: "casso:transaction.received",
                connectionId: "conn-casso",
                params: { data: { transactionId: "tx-2", direction } },
            }
            return {
                source: "tag",
                context: tagContextOf(
                    {
                        source: PROVIDER_TRIGGER_TAG_SOURCE,
                        workspaceId: "ws-1",
                        toAgentId: "agent-1",
                        text: wake.providerTrigger,
                        subject: "bank-transaction:tx-2",
                    },
                    JSON.stringify(wakeContextOf(wake, "notice")),
                ),
                actorMemberId: null,
            }
        }
        const casso = graph.triggers?.find((trigger) => trigger.source.provider === "casso")?.key
        expect(casso).toBeDefined()
        expect(takingTriggerOf(graph, tagSourceOf(cassoWake("in")), triggerScopeOf(cassoWake("in")))).toBe(casso)
        expect(takingTriggerOf(graph, tagSourceOf(cassoWake("out")), triggerScopeOf(cassoWake("out")))).toBeNull()
    })
})

describe("a template graph's own `where`, carried onto every derived registration", () => {
    const spec = INSTALLED.templateGraphOf("webbooks.payment")?.graph.spec

    // Ledger (TOOLS-LEAD W2): the save problem this case named was the core bank road's (it supplied no `direction`); that road left the
    // registry, so every derived source of the credit verb supplies the member and the save finds none.
    it("is carried onto every derived registration, and a member every bank feed supplies is no save problem", () => {
        if (spec === undefined) throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { what: "webbooks.payment is not installed" } })
        const withWhereOf = (entry: GraphV2Trigger): GraphV2Trigger => ({
            ...entry,
            where: [{ param: "data.direction", op: "equals", value: "in" }],
        })
        const [first, ...rest] = spec.triggers
        const withWhere: GraphSpecV2 = { ...spec, triggers: [withWhereOf(first), ...rest.map(withWhereOf)] }
        const adapted = graphOfSpecV2(withWhere, {
            legacyNodeOf: (id) => INSTALLED.nodeInstall().nodes.find((node) => node.id === id),
            templateNodeOf: (id) => INSTALLED.templateNodeOf(id) ?? undefined,
        })
        // Every derived registration carries the graph's condition, the provider roads beside their own credit condition.
        expect(
            adapted.triggers?.every((trigger) =>
                (trigger.conditions ?? []).some((condition) => condition.param === "data.direction"),
            ),
        ).toBe(true)
        expect(
            triggerProblems(adapted.triggers, adapted.contract, providerTriggerLookup).filter(
                (problem) => problem.code === "TRIGGER_CONDITION_UNKNOWN",
            ),
        ).toEqual([])
    })
})
