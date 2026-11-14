import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import type { PageRow } from "@nivo-lite/agent-sdk/entity/port"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { RunStopRecordsService } from "@modules/domain/agent-threads/stops/run-stop-records.service"
import type { RunStop } from "@modules/domain/agent-threads/stops/run-stop.contracts"
import { ConversationContactsService } from "@modules/domain/contacts"
import { NODE_EFFECT_STORE } from "@modules/domain/graph-nodes"
import type { NodeEffectStore, NodeTurn, StoredEffect } from "@modules/domain/graph-nodes"
import { ChannelDeliveriesService } from "@modules/domain/customer-routes"
import { ContactsService } from "@modules/domain/contacts"
import { CLOCK } from "@modules/platform/clock"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { MemoryChannelDeliveryStore } from "@tests/fixtures/builders/customer-routes-stores.builder"
import { installedModules } from "@tests/fixtures/builders/installed-modules.builder"
import { AgentGraphTurnPolicyService } from "./agent-graph-turn-policy.service"

const WS = "11111111-1111-4111-8111-111111111111"
const AT = "2026-11-10T03:00:00.000Z"
const TURN: NodeTurn = {
    turnId: "run-1",
    workspaceId: WS,
    agentId: "agent-1",
    subject: null,
    conversationId: "c-1",
    locale: "vi",
}
const ANSWERED: NodeTurn = { ...TURN, founderAnswers: [{ text: "duy\u1ec7t", at: AT }] }

/** The service with no ledger and no stops: only the module's guidance and tool set. */
const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [AgentGraphTurnPolicyService] }).compile()
    return { policy: moduleRef.get(AgentGraphTurnPolicyService) }
}

describe("AgentGraphTurnPolicyService: the agents the installation lists", () => {
    it("covers the agents of the Zalo flow (the accounting agent was dropped)", () => {
        const keys = installedModules().filter((module) => module.agent !== undefined).map((module) => module.key)
        expect(keys).toEqual(expect.arrayContaining(["chatbot", "sales"]))
        expect(keys).not.toContain("accounting")
    })
})

describe("AgentGraphTurnPolicyService: the guidance of the module's agent", () => {
    it("gives the turn the module's guidance in the run's language and no policy values of its own", async () => {
        const { policy } = await build()

        const told = await policy.toldOf(TURN, "sales", "run-1:create-order")

        expect(told.guidance).toBe(INSTALLED.guidanceOf("sales", "vi"))
        expect(told.guidance).not.toBe("")
        expect(told).not.toHaveProperty("policy")
        expect((await policy.toldOf({ ...TURN, locale: "en" }, "sales", "k")).guidance).toBe(
            INSTALLED.guidanceOf("sales", "en"),
        )
    })

    it("adds nothing for a module that declares no agent", async () => {
        const { policy } = await build()
        await expect(policy.toldOf(TURN, "no-such-module", "k")).resolves.toEqual(TURN)
    })
})

const RUN = "run-1"
const OTHER_RUN = "run-0"
const CONTACT = "contact-1"
const NOW = new Date("2026-11-10T05:00:00.000Z")
const CHECKING = "Da nhan, shop dang kiem tra a."
const OUTCOME = "Shop da xac nhan don a."

const rowOf = (id: string, data: Readonly<Record<string, unknown>>, createdAt = AT): PageRow => ({
    row: { id, workspaceId: WS, version: "1", createdAt, updatedAt: createdAt, data },
    joined: {},
    position: [id],
    included: {},
})

const sendOf = (id: string, text: string, conversationId: string, at: string): PageRow =>
    rowOf(id, { effectId: "nivo.tool.customer.message.send", args: { conversationId, text } }, at)

/** A ledger row of a case as the effect ledger store keeps it: the members the case wrote, a subject a kept act names. */
const effectOf = (row: PageRow): StoredEffect => {
    const { data } = row.row
    const args: unknown = data.args
    return {
        effectKey: row.row.id,
        effectId: String(data.effectId),
        subjectEntity: typeof data.subjectEntity === "string" ? data.subjectEntity : "record",
        subjectId: row.row.id,
        undoneAt: typeof data.undoneAt === "string" ? data.undoneAt : null,
        runId: null,
        stepKey: null,
        args: typeof args === "object" && args !== null && !Array.isArray(args) ? Object.fromEntries(Object.entries(args)) : null,
        facts: null,
        createdAt: row.row.createdAt,
    }
}

interface World {
    /** Ledger rows by `<run>:<step>`. */
    readonly ledger?: Readonly<Record<string, ReadonlyArray<PageRow>>>
    /** Stop rows by state. */
    readonly stops?: Readonly<Record<string, ReadonlyArray<PageRow>>>
    /** The contact each conversation's channel identity resolves to. */
    readonly conversations?: Readonly<Record<string, string | null>>
    /** The engine's delivery ledger: what each run step claimed to send (the real service over its in-memory store). */
    readonly deliveries?: ReadonlyArray<WorldDelivery>
}

/** One send of the delivery ledger of a case, claimed and then settled at `state` (`claimed` stays in flight). */
interface WorldDelivery {
    readonly key: string
    readonly runId: string
    readonly stepKey: string
    readonly text: string
    readonly state: "delivered" | "refused" | "unknown" | "claimed"
    readonly routeId?: string
}

const isLine = (value: unknown): value is RunStop["customerLines"][number] =>
    typeof value === "object" && value !== null && typeof Reflect.get(value, "text") === "string"

const isAnswer = (value: unknown): value is RunStop["answers"][number] =>
    typeof value === "object" && value !== null && typeof Reflect.get(value, "kind") === "string"

/** A stop as the stops' door answers it, from the members a case wrote as the stop keeps them. */
const stopOfRow = (row: PageRow): RunStop => {
    const { data } = row.row
    const lines: unknown = Reflect.get(Object(data.customerLines), "lines")
    const answers: unknown = Reflect.get(Object(data.answers), "answers")
    return {
        id: row.row.id,
        version: row.row.version,
        runId: String(data.runId),
        stepKey: String(data.stepKey),
        agentId: "agent-1",
        workflowId: null,
        contactId: CONTACT,
        conversationId: null,
        kind: "ai_report",
        state: data.resolvedAt === null ? "open" : "resolved",
        reason: typeof data.reason === "string" ? data.reason : "",
        question: typeof data.question === "string" ? data.question : null,
        detail: { suggestions: [], facts: [] },
        cardMessageId: null,
        customerLines: Array.isArray(lines) ? lines.filter(isLine) : [],
        answers: Array.isArray(answers) ? answers.filter(isAnswer) : [],
        decision: null,
        repeats: 1,
        stoppedAt: row.row.createdAt,
        resolvedAt: typeof data.resolvedAt === "string" ? data.resolvedAt : null,
    }
}

/** The service over the stops, the ledger and the conversation a world holds. */
const told = async (world: World) => {
    const contacts = mock<ConversationContactsService>()
    contacts.contactOf.mockImplementation((_workspace, id) => Promise.resolve(world.conversations?.[id] ?? null))
    const ledger = mock<NodeEffectStore>()
    ledger.ofStep.mockImplementation((_workspace, runId, stepKey) =>
        Promise.resolve((world.ledger?.[`${runId}:${stepKey}`] ?? []).map(effectOf)),
    )
    const stops = mock<RunStopRecordsService>()
    stops.ofContacts.mockImplementation((_workspace, ids, state) =>
        Promise.resolve(ids.includes(CONTACT) ? (world.stops?.[state] ?? []).map(stopOfRow) : []),
    )
    const deliveryStore = new MemoryChannelDeliveryStore()
    const people = mock<ContactsService>()
    people.current.mockImplementation((_workspace, id) => Promise.resolve(id))
    const deliveries = new ChannelDeliveriesService(deliveryStore, people)
    for (const one of world.deliveries ?? []) {
        await deliveries.claim(WS, {
            sendKey: one.key,
            routeId: one.routeId ?? "c-1",
            contactId: CONTACT,
            agentId: "agent-1",
            runId: one.runId,
            stepKey: one.stepKey,
            text: one.text,
            attachmentCount: 0,
            attachmentKinds: [],
            channel: "zalo",
            accountId: "conn-1",
        })
        if (one.state === "delivered") await deliveries.mark(WS, one.key, { state: "delivered", providerMessageId: "p-1", at: new Date(AT) })
        if (one.state === "refused") await deliveries.mark(WS, one.key, { state: "refused", reason: "outside_window" })
        if (one.state === "unknown") await deliveries.mark(WS, one.key, { state: "unknown", reason: null })
    }
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphTurnPolicyService,
            { provide: ChannelDeliveriesService, useValue: deliveries },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: ConversationContactsService, useValue: contacts },
            { provide: RunStopRecordsService, useValue: stops },
            { provide: NODE_EFFECT_STORE, useValue: ledger },
        ],
    }).compile()
    return { policy: moduleRef.get(AgentGraphTurnPolicyService), stops, ledger }
}

describe("AgentGraphTurnPolicyService: what the customer was already told, from the effect ledger and the stops (D.1)", () => {
    it("a step that runs again is told its earlier lines from the ledger, whatever conversation they went to (a run with none)", async () => {
        const { policy } = await told({
            ledger: { [`${RUN}:match`]: [sendOf("e-1", CHECKING, "c-9", "2026-11-10T03:01:00.000Z")] },
        })

        const turn = await policy.toldOf({ ...ANSWERED, conversationId: null }, "accounting", `${RUN}:match`)

        expect(turn.alreadySent).toEqual([{ text: CHECKING, at: "2026-11-10T03:01:00.000Z" }])
    })

    it("after the founder's answer, the step's earlier customer line is found in the effect ledger alone (a send addressed to the person, no conversation in its arguments), with no chatbot record read", async () => {
        const { policy, ledger } = await told({
            ledger: {
                [`${RUN}:answer`]: [
                    rowOf("e-1", { effectId: "nivo.tool.customer.message.send", args: { contactId: CONTACT, text: CHECKING } }, "2026-11-10T03:01:00.000Z"),
                ],
            },
        })

        const turn = await policy.toldOf(ANSWERED, "chatbot", `${RUN}:answer`)

        expect(turn.alreadySent).toEqual([{ text: CHECKING, at: "2026-11-10T03:01:00.000Z" }])
        expect(ledger.ofStep).toHaveBeenCalledWith(WS, RUN, "answer", expect.anything())
    })

    describe("what the engine's own delivery ledger adds (a send the effect ledger keeps no words of)", () => {
        /** The effect row of a send that kept no arguments (too large for the ledger's columns, or written before it kept any). */
        const bare = rowOf("e-1", { effectId: "nivo.tool.customer.message.send" }, "2026-11-10T03:01:00.000Z")

        it("tells a re-run step of a send whose effect row keeps no arguments, from the delivery ledger", async () => {
            const { policy } = await told({
                ledger: { [`${RUN}:answer`]: [bare] },
                deliveries: [{ key: "k-1", runId: RUN, stepKey: "answer", text: CHECKING, state: "delivered" }],
            })

            const turn = await policy.toldOf(ANSWERED, "chatbot", `${RUN}:answer`)

            expect(turn.alreadySent).toEqual([{ text: CHECKING, at: AT }])
        })

        it("tells a line present in both ledgers once", async () => {
            const { policy } = await told({
                ledger: { [`${RUN}:answer`]: [sendOf("e-1", CHECKING, "c-1", "2026-11-10T03:01:00.000Z")] },
                deliveries: [{ key: "k-1", runId: RUN, stepKey: "answer", text: CHECKING, state: "delivered" }],
            })

            const turn = await policy.toldOf(ANSWERED, "chatbot", `${RUN}:answer`)

            expect(turn.alreadySent).toHaveLength(1)
            expect(turn.alreadySent?.[0]?.text).toBe(CHECKING)
        })

        it("counts a send whose outcome is unknown or still in flight as possibly told (engine-core rule 9), and a refused one as not told", async () => {
            const { policy } = await told({
                deliveries: [
                    { key: "k-1", runId: RUN, stepKey: "answer", text: "Unknown line", state: "unknown" },
                    { key: "k-2", runId: RUN, stepKey: "answer", text: "In flight line", state: "claimed" },
                    { key: "k-3", runId: RUN, stepKey: "answer", text: "Refused line", state: "refused" },
                ],
            })

            const turn = await policy.toldOf(ANSWERED, "chatbot", `${RUN}:answer`)

            expect(turn.alreadySent?.map((line) => line.text).toSorted()).toEqual(["In flight line", "Unknown line"])
        })

        it("leaves out the delivery of another run or another step, and reads nothing on a first try", async () => {
            const world = {
                deliveries: [
                    { key: "k-1", runId: OTHER_RUN, stepKey: "answer", text: "Other run", state: "delivered" },
                    { key: "k-2", runId: RUN, stepKey: "other", text: "Other step", state: "delivered" },
                    { key: "k-3", runId: RUN, stepKey: "answer", text: "This step", state: "delivered" },
                ],
            } satisfies World
            const { policy } = await told(world)

            const again = await policy.toldOf(ANSWERED, "chatbot", `${RUN}:answer`)
            const first = await policy.toldOf(TURN, "chatbot", `${RUN}:answer`)

            expect(again.alreadySent?.map((line) => line.text)).toEqual(["This step"])
            expect(first.alreadySent).toBeUndefined()
        })
    })

    it("a NEW run of the same customer is told the lines of their open stop, and of a stop resolved within the day", async () => {
        const { policy } = await told({
            conversations: { "c-1": CONTACT },
            stops: {
                open: [
                    rowOf("s-1", {
                        runId: OTHER_RUN,
                        stepKey: "match",
                        customerLines: { lines: [{ conversationId: "c-1", text: CHECKING, at: "2026-11-10T02:00:00.000Z" }] },
                        resolvedAt: null,
                    }),
                ],
                resolved: [
                    rowOf("s-2", {
                        runId: "run-old",
                        stepKey: "settle",
                        customerLines: { lines: [] },
                        resolvedAt: "2026-11-10T01:00:00.000Z",
                    }),
                    rowOf("s-3", {
                        runId: "run-older",
                        stepKey: "settle",
                        customerLines: { lines: [{ conversationId: "c-1", text: "old", at: "2026-11-01T00:00:00.000Z" }] },
                        resolvedAt: "2026-11-02T00:00:00.000Z",
                    }),
                ],
            },
            ledger: {
                [`${OTHER_RUN}:match`]: [sendOf("e-1", CHECKING, "c-1", "2026-11-10T02:00:01.000Z")],
                "run-old:settle": [sendOf("e-2", OUTCOME, "c-1", "2026-11-10T00:30:00.000Z")],
                "run-older:settle": [sendOf("e-3", "older", "c-1", "2026-11-01T00:00:00.000Z")],
            },
        })

        const turn = await policy.toldOf(TURN, "chatbot", `${RUN}:answer`)

        expect(turn.alreadySent).toEqual([
            { text: OUTCOME, at: "2026-11-10T00:30:00.000Z" },
            { text: CHECKING, at: "2026-11-10T02:00:00.000Z" },
        ])
    })

    it("finds the person by the turn's contact, with no conversation", async () => {
        const { policy } = await told({
            stops: {
                open: [
                    rowOf("s-1", {
                        runId: OTHER_RUN,
                        stepKey: "match",
                        customerLines: { lines: [{ conversationId: "c-1", text: CHECKING, at: "2026-11-10T02:00:00.000Z" }] },
                        resolvedAt: null,
                    }),
                ],
            },
        })

        const turn = await policy.toldOf(
            { ...TURN, conversationId: null, contactId: CONTACT },
            "accounting",
            `${RUN}:match`,
        )

        expect(turn.alreadySent).toEqual([{ text: CHECKING, at: "2026-11-10T02:00:00.000Z" }])
    })

    it("on a first try, the step's own ledger records of its open stop are not read (a re-drive is told what its first try was)", async () => {
        const { policy, ledger } = await told({
            conversations: { "c-1": CONTACT },
            stops: {
                open: [rowOf("s-1", { runId: RUN, stepKey: "answer", customerLines: { lines: [] }, resolvedAt: null })],
            },
            ledger: { [`${RUN}:answer`]: [sendOf("e-1", CHECKING, "c-1", "2026-11-10T02:00:00.000Z")] },
        })

        const turn = await policy.toldOf(TURN, "chatbot", `${RUN}:answer`)

        expect(turn.alreadySent).toBeUndefined()
        expect(ledger.ofStep).not.toHaveBeenCalledWith(expect.anything(), RUN, "answer", expect.anything())
    })

    it("tells nothing of a customer with no stop, and reads no stop for a turn with no known customer", async () => {
        const known = await told({ conversations: { "c-1": CONTACT } })
        expect((await known.policy.toldOf(TURN, "chatbot", `${RUN}:answer`)).alreadySent).toBeUndefined()

        const unknown = await told({ conversations: { "c-1": null } })
        expect((await unknown.policy.toldOf(TURN, "chatbot", `${RUN}:answer`)).alreadySent).toBeUndefined()
        expect(unknown.stops.ofContacts).not.toHaveBeenCalled()
    })
})

describe("AgentGraphTurnPolicyService: what THIS run step already did before its stop (D-W8-1, `alreadyDone`)", () => {
    const AT_SEND = "2026-11-10T03:01:00.000Z"

    it("after the founder's answer, lists the effects the step's own ledger records acted, each once", async () => {
        const { policy } = await told({
            ledger: {
                [`${RUN}:check`]: [
                    sendOf("e-1", CHECKING, "c-1", AT_SEND),
                    sendOf("e-2", OUTCOME, "c-1", AT_SEND),
                    rowOf("e-3", { effectId: "nivo.tool.team.message.post", subjectEntity: "agent-task" }),
                ],
            },
        })

        const turn = await policy.toldOf(ANSWERED, "sales", `${RUN}:check`)

        // Sorted by effect id (the ids carry the `nivo.tool.` prefix since the flip, so `customer` comes before `team`).
        expect(turn.alreadyDone).toEqual(["nivo.tool.customer.message.send", "nivo.tool.team.message.post"])
    })

    it("leaves out a refused call, an act of unknown outcome and an undone act", async () => {
        const { policy } = await told({
            ledger: {
                [`${RUN}:check`]: [
                    rowOf("e-1", { effectId: "nivo.tool.customer.message.send", subjectEntity: "refused" }),
                    rowOf("e-2", { effectId: "nivo.tool.order.create", subjectEntity: "outcome-unknown" }),
                    rowOf("e-3", { effectId: "nivo.tool.order.cancel", subjectEntity: "sales.order", undoneAt: AT_SEND }),
                ],
            },
        })

        expect((await policy.toldOf(ANSWERED, "sales", `${RUN}:check`)).alreadyDone).toBeUndefined()
    })

    it("is absent on a first try, for another step of the run, and never filled from another run's stop", async () => {
        const ledger = { [`${RUN}:check`]: [sendOf("e-1", CHECKING, "c-1", AT_SEND)] }
        const { policy } = await told({ ledger })

        expect((await policy.toldOf(TURN, "sales", `${RUN}:check`)).alreadyDone).toBeUndefined()
        expect((await policy.toldOf(ANSWERED, "sales", `${RUN}:thanks`)).alreadyDone).toBeUndefined()
        expect((await policy.toldOf(ANSWERED, "sales", `other-run:check`)).alreadyDone).toBeUndefined()
    })
})

describe("AgentGraphTurnPolicyService: the agent's tool set holds the default reads", () => {
    it("shows every agent its declared tools and the context reads, an agent with no declared search included", async () => {
        const { policy } = await build()

        const chatbot = await policy.toldOf(TURN, "chatbot", "run-1:answer")
        const sales = await policy.toldOf(TURN, "sales", "run-1:consult")

        for (const id of [TOOL.brainSearch, TOOL.conversationMessageList, TOOL.leadOrderList]) {
            expect(chatbot.agentTools).toContain(id)
            expect(sales.agentTools).toContain(id)
        }
        expect(sales.agentTools).toContain(TOOL.customerMessageSend)
        expect(new Set(sales.agentTools).size).toBe(sales.agentTools?.length)
    })
})

// D-MX-1 (live S1, 2026-11-11): the customer asked about a VAT invoice → stop 6712ee93 on the front desk's `answer`; the customer wrote
// again (held); the founder answered "Co xuat VAT, khach gui ma so thue va email, phi 8%"; the resumed step answered right, then the held
// line was replayed into a FRESH front-desk run that did not know the answer and told the customer the 8% was "chua co xac nhan tu tiem".
// The founder's answers on the customer's stops are the one memory of the customer across runs: every later turn reads them.
describe("AgentGraphTurnPolicyService: what the founder decided for the customer reaches every later turn (D-MX-1)", () => {
    const VAT_QUESTION = "Shop co xuat hoa don VAT cho cong ty khong?"
    const VAT_ANSWER = "Co xuat VAT, khach gui ma so thue va email, phi 8%"
    const HOLDING = "Da em hoi lai tiem roi bao minh a"
    const answeredStop = (state: "open" | "resolved"): PageRow =>
        rowOf("s-vat", {
            runId: OTHER_RUN,
            stepKey: "answer",
            question: VAT_QUESTION,
            reason: "Tiem chua co thong tin hoa don VAT",
            customerLines: { lines: [{ conversationId: "c-1", text: HOLDING, at: "2026-11-10T04:00:00.000Z" }] },
            answers: {
                answers: [
                    { kind: "answer", text: VAT_ANSWER, by: "nivo-owner", at: "2026-11-10T04:10:00.000Z" },
                    { kind: "retry", text: null, by: "nivo-owner", at: "2026-11-10T04:11:00.000Z" },
                ],
            },
            resolvedAt: state === "open" ? null : "2026-11-10T04:12:00.000Z",
        })

    it.each(["open", "resolved"] as const)(
        "LIVE S1: the replayed line's FRESH run is told the founder's answer on the stop it waited for (stop %s)",
        async (state) => {
            const { policy } = await told({ conversations: { "c-1": CONTACT }, stops: { [state]: [answeredStop(state)] } })

            const turn = await policy.toldOf(TURN, "chatbot", `${RUN}:answer`)

            expect(turn.founderDecisions).toEqual([
                { question: VAT_QUESTION, answer: VAT_ANSWER, at: "2026-11-10T04:10:00.000Z" },
            ])
            expect(turn.alreadySent).toEqual([{ text: HOLDING, at: "2026-11-10T04:00:00.000Z" }])
        },
    )

    it("a stop's own answers stay `founderAnswers` (the gate's): the resumed step itself is not told them twice", async () => {
        const { policy } = await told({ conversations: { "c-1": CONTACT }, stops: { open: [answeredStop("open")] } })

        const turn = await policy.toldOf(TURN, "chatbot", `${OTHER_RUN}:answer`)

        expect(turn.founderDecisions).toBeUndefined()
    })

    it("a button is no decision in words, and a stop resolved more than a day ago no longer counts", async () => {
        const old = rowOf("s-old", {
            runId: "run-older",
            stepKey: "answer",
            question: "Cu",
            customerLines: { lines: [] },
            answers: { answers: [{ kind: "answer", text: "cu", by: "nivo-owner", at: "2026-11-01T00:00:00.000Z" }] },
            resolvedAt: "2026-11-02T00:00:00.000Z",
        })
        const skipped = rowOf("s-skip", {
            runId: "run-skip",
            stepKey: "answer",
            question: "Bo qua",
            customerLines: { lines: [] },
            answers: { answers: [{ kind: "skip", text: null, by: "nivo-owner", at: "2026-11-10T04:00:00.000Z" }] },
            resolvedAt: "2026-11-10T04:00:00.000Z",
        })
        const { policy } = await told({ conversations: { "c-1": CONTACT }, stops: { resolved: [old, skipped] } })

        expect((await policy.toldOf(TURN, "chatbot", `${RUN}:answer`)).founderDecisions).toBeUndefined()
    })
})
