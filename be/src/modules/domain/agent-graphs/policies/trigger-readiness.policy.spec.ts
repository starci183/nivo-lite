import { Test } from "@nestjs/testing"
import type { WorkflowTrigger } from "@nivo-lite/agent-sdk/graph"
import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import { latestTemplateVersion } from "@nivo-lite/agent-sdk/template"
import { INSTALLED } from "@modules/domain/installed-plugins"
import type { TriggerSwitchRow } from "@modules/domain/trigger-specs"
import { graphReadinessOf } from "./graph-readiness.policy"
import {
    listensThroughSwitch,
    triggerBindingOf,
    triggerFiringOf,
    triggerReadinessOf,
    type TriggerFiring,
    type TriggerReadinessFacts,
} from "./trigger-readiness.policy"
import { TestWorldError, TestWorldErrorCode } from "@tests/world/test-world.error"

/**
 * The trigger side of readiness: a graph can fire when one of its triggers can (the engine's roads, the channels and the core bank road
 * always; a provider trigger when the agent has an account of the provider with the trigger switched on). ONE SOURCE PER STREAM (owner
 * key `triggerOneSource2026_11_12`, CORRECTED 2026-11-12): every attached account of a listed provider is a source when the streams
 * differ; two that read the SAME stream hide the graph (`needs_pick`, naming the stream) until the founder picks one; the other then
 * wakes nothing. The proof at the end: over every installed template, nothing that runs today is hidden.
 */

interface Subject {
    readonly firingOf: typeof triggerFiringOf
    readonly bindingOf: typeof triggerBindingOf
}

const SUBJECT = Symbol("trigger-readiness.policy")

const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { firingOf: triggerFiringOf, bindingOf: triggerBindingOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const CREDITS = [{ param: "direction", op: "equals", value: "in" }] as const

const SEPAY_TRIGGER: WorkflowTrigger = {
    key: "credit",
    source: { kind: "provider", connectionId: null, provider: "sepay", trigger: "transaction.received" },
}
const CASSO_TRIGGER: WorkflowTrigger = {
    key: "credit-3",
    source: { kind: "provider", connectionId: null, provider: "casso", trigger: "transaction.received" },
    conditions: [...CREDITS],
}
const IMAP_TRIGGER: WorkflowTrigger = {
    key: "mail",
    source: { kind: "provider", connectionId: null, provider: "imap", trigger: "mail.received" },
}
const CALL: WorkflowTrigger = { key: "call", source: { kind: "workflow", connectionId: null } }
const CORE_BANK: WorkflowTrigger = { key: "bank", source: { kind: "sepay", connectionId: null } }
const ZALO: WorkflowTrigger = { key: "zalo", source: { kind: "zalo", connectionId: null } }

const on = (triggerName: string): TriggerSwitchRow => ({ triggerName, enabled: true })
const off = (triggerName: string): TriggerSwitchRow => ({ triggerName, enabled: false })

const SEPAY_ACCOUNT = { connectionId: "s1", provider: "sepay" }
const SEPAY_ACCOUNT_B = { connectionId: "s2", provider: "sepay" }
const CASSO_ACCOUNT = { connectionId: "c1", provider: "casso" }

/** A bank account's public facts, as the money wizard stores them. */
const bank = (account: string): Readonly<Record<string, string>> => ({ bank_code: "VCB", account_number: account })
/** A mailbox's public facts, as the IMAP connect road stores them. */
const mailbox = (email: string): Readonly<Record<string, string>> => ({ email })

const ALL_ON = new Map([
    ["s1", [on("transaction.received")]],
    ["s2", [on("transaction.received")]],
    ["c1", [on("transaction.received")]],
])

const CASES: ReadonlyArray<{
    readonly name: string
    readonly triggers: ReadonlyArray<WorkflowTrigger> | undefined
    readonly facts: TriggerReadinessFacts
    readonly expected: TriggerFiring
}> = [
    {
        name: "a graph from before contracts fires",
        triggers: undefined,
        facts: { attachments: [] },
        expected: { canFire: true },
    },
    { name: "a workflow call always fires", triggers: [CALL], facts: { attachments: [] }, expected: { canFire: true } },
    {
        name: "a customer channel fires with no attachment (the connection's owner agent is woken by the intake)",
        triggers: [ZALO],
        facts: { attachments: [], switches: new Map() },
        expected: { canFire: true },
    },
    {
        name: "the core bank road fires with no switch",
        triggers: [CORE_BANK],
        facts: { attachments: [], switches: new Map() },
        expected: { canFire: true },
    },
    {
        name: "a provider trigger with no account of the provider: not connected",
        triggers: [SEPAY_TRIGGER],
        facts: { attachments: [], switches: new Map() },
        expected: {
            canFire: false,
            blocked: [{ provider: "sepay", verb: TRIGGER.paymentCreditReceived, reason: "not_connected" }],
        },
    },
    {
        name: "a provider trigger whose account keeps it off (no row = off): trigger off",
        triggers: [SEPAY_TRIGGER],
        facts: { attachments: [SEPAY_ACCOUNT], switches: new Map([["s1", [off("transaction.received")]]]) },
        expected: {
            canFire: false,
            blocked: [{ provider: "sepay", verb: TRIGGER.paymentCreditReceived, reason: "trigger_off" }],
        },
    },
    {
        name: "another trigger switched on does not count",
        triggers: [SEPAY_TRIGGER],
        facts: { attachments: [SEPAY_ACCOUNT], switches: new Map([["s1", [on("something.else")]]]) },
        expected: {
            canFire: false,
            blocked: [{ provider: "sepay", verb: TRIGGER.paymentCreditReceived, reason: "trigger_off" }],
        },
    },
    {
        name: "a provider trigger switched on fires",
        triggers: [SEPAY_TRIGGER],
        facts: { attachments: [SEPAY_ACCOUNT], switches: new Map([["s1", [on("transaction.received")]]]) },
        expected: { canFire: true },
    },
    {
        name: "switches unreadable: an attached account counts as on",
        triggers: [SEPAY_TRIGGER],
        facts: { attachments: [SEPAY_ACCOUNT] },
        expected: { canFire: true },
    },
    {
        name: "a trigger pinned to one account (the stored @1 member) is judged on that account only",
        triggers: [{ ...SEPAY_TRIGGER, source: { ...SEPAY_TRIGGER.source, connectionId: "s2" } }],
        facts: { attachments: [SEPAY_ACCOUNT], switches: new Map([["s1", [on("transaction.received")]]]) },
        expected: {
            canFire: false,
            blocked: [{ provider: "sepay", verb: TRIGGER.paymentCreditReceived, reason: "not_connected" }],
        },
    },
    {
        name: "a single attached account fires with no pick: its switch decides",
        triggers: [SEPAY_TRIGGER],
        facts: { attachments: [SEPAY_ACCOUNT], switches: new Map([["s1", [off("transaction.received")]]]) },
        expected: {
            canFire: false,
            blocked: [{ provider: "sepay", verb: TRIGGER.paymentCreditReceived, reason: "trigger_off" }],
        },
    },
    {
        // Ledger (owner key triggerOneSource2026_11_12, CORRECTED 2026-11-12): was `needs_pick` (one account per trigger); two accounts
        // of the provider whose streams differ (here: unknown, so each its own) are both sources.
        name: "two accounts of the provider, streams unknown (each its own): both fire, no pick",
        triggers: [SEPAY_TRIGGER],
        facts: { attachments: [SEPAY_ACCOUNT, SEPAY_ACCOUNT_B], switches: ALL_ON },
        expected: { canFire: true },
    },
    {
        // Ledger (owner key triggerOneSource2026_11_12, CORRECTED 2026-11-12): was `needs_pick` with the switches unreadable.
        name: "switches unreadable and two accounts of different streams: fires",
        triggers: [SEPAY_TRIGGER],
        facts: {
            attachments: [SEPAY_ACCOUNT, SEPAY_ACCOUNT_B],
            publicFacts: new Map([
                ["s1", bank("111")],
                ["s2", bank("222")],
            ]),
        },
        expected: { canFire: true },
    },
    {
        name: "a pinned account, switched on, fires; another account switched on does not count for it",
        triggers: [{ ...SEPAY_TRIGGER, source: { ...SEPAY_TRIGGER.source, connectionId: "s2" } }],
        facts: {
            attachments: [SEPAY_ACCOUNT, SEPAY_ACCOUNT_B],
            switches: new Map([
                ["s1", [on("transaction.received")]],
                ["s2", [off("transaction.received")]],
            ]),
        },
        expected: {
            canFire: false,
            blocked: [{ provider: "sepay", verb: TRIGGER.paymentCreditReceived, reason: "trigger_off" }],
        },
    },
    {
        name: "three mailboxes (cto@, ketoan@, support@) all fire",
        triggers: [IMAP_TRIGGER],
        facts: {
            attachments: ["m1", "m2", "m3"].map((connectionId) => ({ connectionId, provider: "imap" })),
            switches: new Map(["m1", "m2", "m3"].map((id) => [id, [on("mail.received")]])),
            publicFacts: new Map([
                ["m1", mailbox("cto@shop.vn")],
                ["m2", mailbox("ketoan@shop.vn")],
                ["m3", mailbox("support@shop.vn")],
            ]),
        },
        expected: { canFire: true },
    },
    {
        name: "two connections of ONE mailbox: needs a pick for that stream, named",
        triggers: [IMAP_TRIGGER],
        facts: {
            attachments: ["m1", "m2"].map((connectionId) => ({ connectionId, provider: "imap" })),
            switches: new Map(["m1", "m2"].map((id) => [id, [on("mail.received")]])),
            publicFacts: new Map([
                ["m1", mailbox("KeToan@shop.vn")],
                ["m2", mailbox("ketoan@shop.vn ")],
            ]),
        },
        expected: {
            canFire: false,
            blocked: [
                {
                    provider: "imap",
                    verb: TRIGGER.mailMessageReceived,
                    reason: "needs_pick",
                    stream: "mailbox:ketoan@shop.vn",
                    connectionIds: ["m1", "m2"],
                },
            ],
        },
    },
    {
        name: "SePay and Casso on DIFFERENT bank accounts: both fire",
        triggers: [CORE_BANK, SEPAY_TRIGGER, CASSO_TRIGGER],
        facts: {
            attachments: [SEPAY_ACCOUNT, CASSO_ACCOUNT],
            switches: ALL_ON,
            publicFacts: new Map([
                ["s1", bank("111")],
                ["c1", bank("222")],
            ]),
        },
        expected: { canFire: true },
    },
    {
        name: "SePay and Casso on the SAME bank account: needs a pick for that stream, both providers named, even beside the core road",
        triggers: [CORE_BANK, SEPAY_TRIGGER, CASSO_TRIGGER],
        facts: {
            attachments: [SEPAY_ACCOUNT, CASSO_ACCOUNT],
            switches: ALL_ON,
            publicFacts: new Map([
                ["s1", bank("0111 222")],
                ["c1", bank("0111222")],
            ]),
        },
        expected: {
            canFire: false,
            blocked: [
                {
                    provider: "sepay",
                    verb: TRIGGER.paymentCreditReceived,
                    reason: "needs_pick",
                    stream: "bank-account:VCB:0111222",
                    connectionIds: ["s1", "c1"],
                },
                {
                    provider: "casso",
                    verb: TRIGGER.paymentCreditReceived,
                    reason: "needs_pick",
                    stream: "bank-account:VCB:0111222",
                    connectionIds: ["s1", "c1"],
                },
            ],
        },
    },
    {
        name: "the same bank account, the founder picked Casso: fires",
        triggers: [CORE_BANK, SEPAY_TRIGGER, CASSO_TRIGGER],
        facts: {
            attachments: [SEPAY_ACCOUNT, CASSO_ACCOUNT],
            switches: ALL_ON,
            publicFacts: new Map([
                ["s1", bank("111")],
                ["c1", bank("111")],
            ]),
            picks: [{ verb: TRIGGER.paymentCreditReceived, stream: "bank-account:VCB:111", connectionId: "c1" }],
        },
        expected: { canFire: true },
    },
    {
        name: "a pick naming an account outside the contested stream, or another verb, picks nothing",
        triggers: [CORE_BANK, SEPAY_TRIGGER, CASSO_TRIGGER],
        facts: {
            attachments: [SEPAY_ACCOUNT, CASSO_ACCOUNT],
            switches: ALL_ON,
            publicFacts: new Map([
                ["s1", bank("111")],
                ["c1", bank("111")],
            ]),
            picks: [
                { verb: TRIGGER.paymentCreditReceived, stream: "bank-account:VCB:111", connectionId: "s9" },
                { verb: TRIGGER.mailMessageReceived, stream: "bank-account:VCB:111", connectionId: "c1" },
            ],
        },
        expected: {
            canFire: false,
            blocked: [
                {
                    provider: "sepay",
                    verb: TRIGGER.paymentCreditReceived,
                    reason: "needs_pick",
                    stream: "bank-account:VCB:111",
                    connectionIds: ["s1", "c1"],
                },
                {
                    provider: "casso",
                    verb: TRIGGER.paymentCreditReceived,
                    reason: "needs_pick",
                    stream: "bank-account:VCB:111",
                    connectionIds: ["s1", "c1"],
                },
            ],
        },
    },
    {
        name: "the same bank account with Casso's trigger switched off: Casso wakes nothing, so nothing is contested",
        triggers: [CORE_BANK, SEPAY_TRIGGER, CASSO_TRIGGER],
        facts: {
            attachments: [SEPAY_ACCOUNT, CASSO_ACCOUNT],
            switches: new Map([
                ["s1", [on("transaction.received")]],
                ["c1", [off("transaction.received")]],
            ]),
            publicFacts: new Map([
                ["s1", bank("111")],
                ["c1", bank("111")],
            ]),
        },
        expected: { canFire: true },
    },
    {
        name: "one trigger that fires is enough",
        triggers: [IMAP_TRIGGER, SEPAY_TRIGGER, CALL],
        facts: { attachments: [], switches: new Map() },
        expected: { canFire: true },
    },
    {
        name: "none fires: every provider named once, in the triggers' order",
        triggers: [IMAP_TRIGGER, SEPAY_TRIGGER],
        facts: { attachments: [SEPAY_ACCOUNT], switches: new Map([["s1", []]]) },
        expected: {
            canFire: false,
            blocked: [
                { provider: "imap", verb: TRIGGER.mailMessageReceived, reason: "not_connected" },
                { provider: "sepay", verb: TRIGGER.paymentCreditReceived, reason: "trigger_off" },
            ],
        },
    },
]

describe("triggerFiringOf", () => {
    it.each(CASES.map((one) => [one.name, one] as const))("%s", async (_name, one) => {
        const { firingOf } = await build()
        expect(firingOf({ triggers: one.triggers }, one.facts)).toEqual(one.expected)
    })

    it("hides through E4's hook, naming the providers and the contested stream", async () => {
        const { firingOf } = await build()
        const firing = firingOf({ triggers: [SEPAY_TRIGGER] }, { attachments: [], switches: new Map() })
        expect(graphReadinessOf({ nodes: [] }, { attachments: [], triggers: triggerReadinessOf(firing) })).toEqual({
            hidden: true,
            waitingFor: ["sepay"],
            blocked: [{ provider: "sepay", verb: TRIGGER.paymentCreditReceived, reason: "not_connected" }],
        })
        expect(triggerReadinessOf({ canFire: true })).toEqual({ waitingFor: [], blocked: [] })
        const contested = firingOf(
            { triggers: [IMAP_TRIGGER] },
            {
                attachments: ["m1", "m2"].map((connectionId) => ({ connectionId, provider: "imap" })),
                publicFacts: new Map([
                    ["m1", mailbox("a@b.vn")],
                    ["m2", mailbox("a@b.vn")],
                ]),
            },
        )
        expect(graphReadinessOf({ nodes: [] }, { attachments: [], triggers: triggerReadinessOf(contested) })).toEqual({
            hidden: true,
            waitingFor: ["imap"],
            blocked: [
                {
                    provider: "imap",
                    verb: TRIGGER.mailMessageReceived,
                    reason: "needs_pick",
                    stream: "mailbox:a@b.vn",
                    connectionIds: ["m1", "m2"],
                },
            ],
        })
    })
})

describe("a trigger on by default (a compose provider's render completion, concept triggers rule 6a)", () => {
    const RENDER: WorkflowTrigger = {
        key: "rendered",
        source: { kind: "provider", connectionId: null, provider: "shotstack", trigger: "render.completed" },
    }
    const account = { connectionId: "v1", provider: "shotstack" }

    it("fires for an account with no switch row; a person's `off` row keeps it from firing; a bank feed with no row stays off", async () => {
        const { firingOf } = await build()
        expect(firingOf({ triggers: [RENDER] }, { attachments: [account], switches: new Map([["v1", []]]) })).toEqual({
            canFire: true,
        })
        expect(
            firingOf(
                { triggers: [RENDER] },
                { attachments: [account], switches: new Map([["v1", [off("render.completed")]]]) },
            ),
        ).toEqual({
            canFire: false,
            blocked: [{ provider: "shotstack", verb: TRIGGER.videoRenderCompleted, reason: "trigger_off" }],
        })
        expect(
            firingOf({ triggers: [SEPAY_TRIGGER] }, { attachments: [SEPAY_ACCOUNT], switches: new Map([["s1", []]]) }),
        ).toMatchObject({
            canFire: false,
        })
    })
})

describe("triggerBindingOf: which accounts are sources, which wake nothing", () => {
    const sameBank: TriggerReadinessFacts = {
        attachments: [SEPAY_ACCOUNT, CASSO_ACCOUNT],
        switches: ALL_ON,
        publicFacts: new Map([
            ["s1", bank("111")],
            ["c1", bank("111")],
        ]),
    }
    const graph = { triggers: [CORE_BANK, SEPAY_TRIGGER, CASSO_TRIGGER] }
    const verb = TRIGGER.paymentCreditReceived

    it("after a pick the picked account is the stream's one source and the other is muted", async () => {
        const { bindingOf } = await build()
        const picked = bindingOf(graph, {
            ...sameBank,
            picks: [{ verb, stream: "bank-account:VCB:111", connectionId: "c1" }],
        })
        expect(picked).toEqual({
            sources: [{ verb, provider: "casso", connectionId: "c1", stream: "bank-account:VCB:111" }],
            muted: [{ verb, provider: "sepay", connectionId: "s1", stream: "bank-account:VCB:111" }],
            contested: [],
        })
    })

    it("with no pick the stream is contested and no account of it is a source", async () => {
        const { bindingOf } = await build()
        expect(bindingOf(graph, sameBank)).toEqual({
            sources: [],
            muted: [],
            contested: [
                {
                    verb,
                    stream: "bank-account:VCB:111",
                    accounts: [
                        { provider: "sepay", connectionId: "s1" },
                        { provider: "casso", connectionId: "c1" },
                    ],
                },
            ],
        })
    })

    it("accounts of different streams are all sources", async () => {
        const { bindingOf } = await build()
        const two = bindingOf(graph, {
            ...sameBank,
            publicFacts: new Map([
                ["s1", bank("111")],
                ["c1", bank("222")],
            ]),
        })
        expect(two.sources.map((source) => [source.connectionId, source.stream])).toEqual([
            ["s1", "bank-account:VCB:111"],
            ["c1", "bank-account:VCB:222"],
        ])
        expect(two.muted).toEqual([])
    })
})

/** The agents whose behaviour must not change: the three core agents, then the five agents the NIVO Web plugin wires. */
const MODULES = ["sales", "chatbot", "accounting", "webmail", "webdocs", "webrenew", "webdesk", "webbooks"]

/** Every installed template's latest graph, by template id. */
const latest = (): ReadonlyArray<readonly [string, ReturnType<typeof latestTemplateVersion>["graph"]]> =>
    MODULES.flatMap((moduleKey) =>
        INSTALLED.templatesOf(moduleKey).map(
            (template) => [template.id, latestTemplateVersion(template).graph] as const,
        ),
    )

/** The providers a graph's triggers are bound to the accounts of (a channel's, the core road's and a provider trigger's provider). */
const providersOf = (graph: {
    readonly triggers?: ReadonlyArray<WorkflowTrigger> | undefined
}): ReadonlyArray<string> => [
    ...new Set(
        (graph.triggers ?? []).flatMap((trigger) =>
            trigger.source.kind === "provider" ? (trigger.source.provider ?? []) : [],
        ),
    ),
]

/** Every provider trigger a graph registers on, switched on, for each of these accounts. */
const switchesOn = (
    graph: { readonly triggers?: ReadonlyArray<WorkflowTrigger> | undefined },
    accounts: ReadonlyArray<{ readonly connectionId: string; readonly provider: string }>,
): ReadonlyMap<string, ReadonlyArray<TriggerSwitchRow>> =>
    new Map(
        accounts.map((account) => [
            account.connectionId,
            (graph.triggers ?? [])
                .filter((trigger) => trigger.source.provider === account.provider)
                .map((trigger) => on(trigger.source.trigger ?? "")),
        ]),
    )

describe("the trigger side hides nothing that runs today", () => {
    it("with no account and no switch at all, hidden are exactly the templates EVERY trigger of which is a provider trigger", async () => {
        const { firingOf } = await build()
        const templates = latest()
        expect(templates.length).toBeGreaterThan(0)
        const hidden = templates.filter(
            ([, graph]) => !firingOf(graph, { attachments: [], switches: new Map() }).canFire,
        )
        for (const [id, graph] of hidden) {
            // Such a template runs today only through the provider trigger's emit point, which starts nothing while the switch is off.
            expect([id, (graph.triggers ?? []).every((trigger) => trigger.source.kind === "provider")]).toEqual([
                id,
                true,
            ])
        }
        const onlyProvider = templates.filter(
            ([, graph]) =>
                (graph.triggers ?? []).length > 0 &&
                (graph.triggers ?? []).every((trigger) => trigger.source.kind === "provider"),
        )
        expect(hidden.map(([id]) => id)).toEqual(onlyProvider.map(([id]) => id))
    })

    it("every workflow-called, channel, clock, timer, team-chat, website and core-bank template fires for an agent with nothing attached", async () => {
        const { firingOf } = await build()
        const engineRoads = latest().filter(([, graph]) =>
            (graph.triggers ?? []).some((trigger) => trigger.source.kind !== "provider"),
        )
        expect(engineRoads.length).toBeGreaterThan(0)
        expect(
            engineRoads.filter(([, graph]) => !firingOf(graph, { attachments: [], switches: new Map() }).canFire),
        ).toEqual([])
    })

    it("every template fires once its providers' accounts are attached with their triggers on (one account each: no pick)", async () => {
        const { firingOf } = await build()
        for (const [id, graph] of latest()) {
            const providers = providersOf(graph)
            const attachments = providers.map((provider) => ({ connectionId: `${provider}-1`, provider }))
            expect([id, firingOf(graph, { attachments, switches: switchesOn(graph, attachments) }).canFire]).toEqual([
                id,
                true,
            ])
            expect(listensThroughSwitch(graph)).toBe(providers.length > 0)
        }
    })

    it("every template fires with SEVERAL accounts of each provider, streams unknown or different (no pick needed)", async () => {
        const { firingOf } = await build()
        for (const [id, graph] of latest()) {
            const attachments = providersOf(graph).flatMap((provider) =>
                [1, 2, 3].map((at) => ({ connectionId: `${provider}-${at}`, provider })),
            )
            const switches = switchesOn(graph, attachments)
            expect([id, firingOf(graph, { attachments, switches }).canFire]).toEqual([id, true])
            const publicFacts = new Map(
                attachments.map((account, at) => [
                    account.connectionId,
                    { ...bank(`9000${at}`), ...mailbox(`box${at}@shop.vn`), oa_id: `oa${at}`, bot_id: `${at}` },
                ]),
            )
            expect([id, firingOf(graph, { attachments, switches, publicFacts }).canFire]).toEqual([id, true])
        }
    })
})

describe("the shipped graphs, bound in a workspace", () => {
    const graphOf = (key: string) => {
        const template = INSTALLED.templateOf(key)
        if (template === null) throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { what: `${key} is not installed` } })
        return latestTemplateVersion(template).graph
    }

    it("webmail.triage: three attached mailboxes are three sources of its one mail trigger", async () => {
        const { bindingOf, firingOf } = await build()
        const graph = graphOf("webmail.triage")
        const attachments = ["cto", "ketoan", "support"].map((box) => ({ connectionId: box, provider: "imap" }))
        const facts: TriggerReadinessFacts = {
            attachments,
            switches: switchesOn(graph, attachments),
            publicFacts: new Map(
                attachments.map((account) => [account.connectionId, mailbox(`${account.connectionId}@shop.vn`)]),
            ),
        }
        expect(bindingOf(graph, facts).sources).toEqual(
            ["cto", "ketoan", "support"].map((box) => ({
                verb: TRIGGER.mailMessageReceived,
                provider: "imap",
                connectionId: box,
                stream: `mailbox:${box}@shop.vn`,
            })),
        )
        expect(firingOf(graph, facts)).toEqual({ canFire: true })
    })

    it("webbooks.payment: SePay and Casso on two bank accounts both fire; on one, the founder picks", async () => {
        const { bindingOf, firingOf } = await build()
        // (The bank-fed `accounting.reconcile` was the other graph of this loop; it left with the money, owner decision wave 4.)
        for (const key of ["webbooks.payment"]) {
            const graph = graphOf(key)
            const attachments = [SEPAY_ACCOUNT, CASSO_ACCOUNT]
            const switches = switchesOn(graph, attachments)
            const two = {
                attachments,
                switches,
                publicFacts: new Map([
                    ["s1", bank("111")],
                    ["c1", bank("222")],
                ]),
            }
            expect([key, bindingOf(graph, two).sources.map((source) => source.provider)]).toEqual([
                key,
                ["sepay", "casso"],
            ])
            expect([key, firingOf(graph, two)]).toEqual([key, { canFire: true }])
            const one = {
                ...two,
                publicFacts: new Map([
                    ["s1", bank("111")],
                    ["c1", bank("111")],
                ]),
            }
            expect([key, firingOf(graph, one)]).toEqual([
                key,
                {
                    canFire: false,
                    blocked: [
                        {
                            provider: "sepay",
                            verb: TRIGGER.paymentCreditReceived,
                            reason: "needs_pick",
                            stream: "bank-account:VCB:111",
                            connectionIds: ["s1", "c1"],
                        },
                        {
                            provider: "casso",
                            verb: TRIGGER.paymentCreditReceived,
                            reason: "needs_pick",
                            stream: "bank-account:VCB:111",
                            connectionIds: ["s1", "c1"],
                        },
                    ],
                },
            ])
            const picked = {
                ...one,
                picks: [{ verb: TRIGGER.paymentCreditReceived, stream: "bank-account:VCB:111", connectionId: "s1" }],
            }
            expect([key, firingOf(graph, picked)]).toEqual([key, { canFire: true }])
            expect([key, bindingOf(graph, picked).muted.map((source) => source.connectionId)]).toEqual([key, ["c1"]])
        }
    })
})
