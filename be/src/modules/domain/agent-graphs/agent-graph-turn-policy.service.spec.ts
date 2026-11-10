import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import type { PageRow } from "@nivo-lite/agent-sdk/entity/port"
import { queryProblems } from "@nivo-lite/agent-sdk/query"
import type { Query } from "@nivo-lite/agent-sdk/query"
import { FLOW_F_ENTITIES, agentNodeEffectEntity, agentRunStopEntity, conversationEntity } from "@nivo-lite/blocks-core/entities"
import { MODULE_DECLARATIONS, agentGuidanceOf } from "@nivo-lite/blocks-core/modules"
import { EntityEngineService } from "@modules/domain/entity-engine"
import type { ScopedTx } from "@modules/domain/entity-engine"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeDataPort, NodeTurn } from "@modules/domain/graph-nodes"
import { CLOCK } from "@modules/platform/clock"
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
const ANSWERED: NodeTurn = { ...TURN, founderAnswers: [{ text: "duyệt", at: AT }] }

const settingsRow = (data: Readonly<Record<string, unknown>>): PageRow => ({
    row: { id: "s-1", workspaceId: WS, version: "1", createdAt: AT, updatedAt: AT, data },
    joined: {},
    position: ["s-1"],
    included: {},
})

/** The real entity declarations by name: the engine refuses a list no declared index serves, and so does this fake. */
const CATALOG: ReadonlyMap<string, EntityDefinition> = new Map(
    FLOW_F_ENTITIES.map((entity): [string, EntityDefinition] => [entity.name, entity as EntityDefinition]),
)

/**
 * The service over an engine that knows the real entity declarations, refuses a list the engine would refuse (an unindexed order),
 * and whose `sales.settings` holds `saved` (no record when null).
 */
const build = async (saved: Readonly<Record<string, unknown>> | null, lines?: NodeDataPort) => {
    const engine = mock<EntityEngineService>()
    engine.scoped.mockImplementation((_workspace, work) => work(mock<ScopedTx>()))
    engine.definition.mockImplementation((name) => {
        const entity = CATALOG.get(name)
        if (entity === undefined) throw new Error(`unknown entity ${name}`)
        return entity
    })
    engine.list.mockImplementation((_tx, query: Query) => {
        const problems = queryProblems(query, CATALOG)
        if (problems.length > 0) return Promise.reject(new Error(`ENTITY_ENGINE_QUERY_INVALID ${JSON.stringify(problems)}`))
        const rows = query.from === "sales.settings" && saved !== null ? [settingsRow(saved)] : []
        return Promise.resolve({ rows, next: null })
    })
    const nodes = mock<GraphNodeRegistryService>()
    nodes.optionalPortOf.mockReturnValue(lines)
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphTurnPolicyService,
            { provide: EntityEngineService, useValue: engine },
            { provide: GraphNodeRegistryService, useValue: nodes },
        ],
    }).compile()
    return { policy: moduleRef.get(AgentGraphTurnPolicyService), engine, nodes }
}

describe("AgentGraphTurnPolicyService: the settings read against the real entity declarations", () => {
    it.each(MODULE_DECLARATIONS.filter((module) => module.agent !== undefined).map((module) => module.key))(
        "reads the policy values of the %s agent with a query the engine serves",
        async (moduleKey) => {
            const { policy } = await build({})
            const defaults = MODULE_DECLARATIONS.find((module) => module.key === moduleKey)?.agent?.policy.limits ?? {}
            await expect(policy.valuesOf(WS, moduleKey, defaults)).resolves.toEqual(defaults)
        },
    )

    it("covers the three agents of the Zalo flow", () => {
        const keys = MODULE_DECLARATIONS.filter((module) => module.agent !== undefined).map((module) => module.key)
        expect(keys).toEqual(expect.arrayContaining(["chatbot", "sales", "accounting"]))
    })
})

describe("AgentGraphTurnPolicyService: the policy of the module's agent", () => {
    it("gives the turn the module's guidance in the run's language and the workspace's own value over the default", async () => {
        const { policy, engine } = await build({ approvalThresholdVnd: 3_000_000 })

        const told = await policy.toldOf(TURN, "sales", "run-1:create-order")

        expect(told.guidance).toBe(agentGuidanceOf("sales", "vi"))
        expect(told.guidance).not.toBe("")
        expect(told.policy).toEqual({
            approvalThresholdVnd: 3_000_000,
            paymentReminderHours: 2,
            paymentStaleHours: 24,
            autoWon: true,
        })
        expect(engine.list).toHaveBeenCalledWith(
            expect.anything(),
            {
                from: "sales.settings",
                select: ["approvalThresholdVnd", "autoWon"],
                order: [
                    ["key", "asc"],
                    ["id", "asc"],
                ],
                page: { size: 1 },
            },
            expect.any(String),
        )
        expect((await policy.toldOf({ ...TURN, locale: "en" }, "sales", "k")).guidance).toBe(
            agentGuidanceOf("sales", "en"),
        )
    })

    it("keeps the module's defaults for a workspace that saved no settings", async () => {
        const { policy } = await build(null)
        const told = await policy.toldOf(TURN, "sales", "run-1:create-order")
        expect(told.policy).toEqual({
            approvalThresholdVnd: 5_000_000,
            paymentReminderHours: 2,
            paymentStaleHours: 24,
            autoWon: true,
        })
    })

    it("keeps the defaults without reading when the module's settings hold none of the policy's names", async () => {
        const { policy, engine } = await build({ approvalThresholdVnd: 1 })

        const told = await policy.toldOf(TURN, "accounting", "run-1:match")

        expect(told.guidance).toBe(agentGuidanceOf("accounting", "vi"))
        expect(told.policy).toEqual({ refund: "never" })
        expect(engine.list).not.toHaveBeenCalled()
    })

    it("adds nothing for a module that declares no agent", async () => {
        const { policy } = await build(null)
        await expect(policy.toldOf(TURN, "no-such-module", "k")).resolves.toEqual(TURN)
    })
})

describe("AgentGraphTurnPolicyService: what a step that runs again already sent", () => {
    const linesPort = (): jest.Mocked<NodeDataPort> => {
        const port = mock<NodeDataPort>({ kind: "message" })
        port.read.mockResolvedValue([
            { channelRef: "line:run-1:create-order:aaaa", text: "Dạ shop đang kiểm tra ạ.", sentAt: AT },
            { channelRef: "line:run-1:consult:bbbb", text: "Mình cần giao ở đâu ạ?", sentAt: AT },
        ])
        return port
    }

    it("lists the lines kept under the step's key, read among the conversation's latest agent lines", async () => {
        const port = linesPort()
        const { policy } = await build(null, port)

        const told = await policy.toldOf(ANSWERED, "sales", "run-1:create-order")

        expect(told.alreadySent).toEqual([{ text: "Dạ shop đang kiểm tra ạ.", at: AT }])
        expect(port.read).toHaveBeenCalledWith(
            ANSWERED,
            { where: { conversationId: "c-1", role: "agent" }, fields: ["text", "sentAt", "channelRef"], limit: 20 },
            "workspace",
        )
    })

    it("reads nothing on a first try, without a conversation, or when the app serves no conversation lines", async () => {
        const port = linesPort()
        const first = await build(null, port)
        expect((await first.policy.toldOf(TURN, "sales", "run-1:create-order")).alreadySent).toBeUndefined()
        const calling = await first.policy.toldOf({ ...ANSWERED, conversationId: null }, "sales", "run-1:create-order")
        expect(calling.alreadySent).toBeUndefined()
        expect(port.read).not.toHaveBeenCalled()

        const unserved = await build(null)
        expect((await unserved.policy.toldOf(ANSWERED, "sales", "run-1:create-order")).alreadySent).toBeUndefined()
    })
})

const RUN = "run-1"
const OTHER_RUN = "run-0"
const LEAD = "lead-1"
const NOW = new Date("2026-11-10T05:00:00.000Z")
const CHECKING = "Da nhan, shop dang kiem tra a."
const OUTCOME = "Shop da xac nhan don a."

/** The real declarations of the ledger, the stops and the conversation, beside the flow's. */
const TOLD_CATALOG: ReadonlyMap<string, EntityDefinition> = new Map([
    ...CATALOG,
    ...[agentNodeEffectEntity, agentRunStopEntity, conversationEntity].map(
        (entity): [string, EntityDefinition] => [entity.name, entity as EntityDefinition],
    ),
])

const rowOf = (id: string, data: Readonly<Record<string, unknown>>, createdAt = AT): PageRow => ({
    row: { id, workspaceId: WS, version: "1", createdAt, updatedAt: createdAt, data },
    joined: {},
    position: [id],
    included: {},
})

const sendOf = (id: string, text: string, conversationId: string, at: string): PageRow =>
    rowOf(id, { effectId: "customer.message.send", args: { conversationId, text } }, at)

interface World {
    /** Ledger rows by `<run>:<step>`. */
    readonly ledger?: Readonly<Record<string, ReadonlyArray<PageRow>>>
    /** Stop rows by state. */
    readonly stops?: Readonly<Record<string, ReadonlyArray<PageRow>>>
    /** The customer each conversation names. */
    readonly conversations?: Readonly<Record<string, string | null>>
}

/** The service over an engine that knows the real declarations and refuses any list no declared index serves. */
const told = async (world: World) => {
    const engine = mock<EntityEngineService>()
    engine.scoped.mockImplementation((_workspace, work) => work(mock<ScopedTx>()))
    engine.definition.mockImplementation((name) => {
        const entity = TOLD_CATALOG.get(name)
        if (entity === undefined) throw new Error(`unknown entity ${name}`)
        return entity
    })
    engine.get.mockImplementation((_tx, entity, id) => {
        const leadId = world.conversations?.[id]
        return Promise.resolve(
            entity === "chat.conversation" && leadId !== undefined ? rowOf(id, { leadId }).row : null,
        )
    })
    engine.list.mockImplementation((_tx, query: Query) => {
        const problems = queryProblems(query, TOLD_CATALOG)
        if (problems.length > 0) return Promise.reject(new Error(`ENTITY_ENGINE_QUERY_INVALID ${JSON.stringify(problems)}`))
        const pinned = Object.fromEntries(
            (query.where?.op === "and" ? query.where.of : []).flatMap((part) =>
                part.op === "eq" ? [[part.field, part.value]] : [],
            ),
        )
        if (query.from === "agent.node-effect")
            return Promise.resolve({ rows: world.ledger?.[`${pinned.runId}:${pinned.stepKey}`] ?? [], next: null })
        if (query.from === "agent.run-stop")
            return Promise.resolve({
                rows: pinned.leadId === LEAD ? (world.stops?.[String(pinned.state)] ?? []) : [],
                next: null,
            })
        return Promise.resolve({ rows: [], next: null })
    })
    const nodes = mock<GraphNodeRegistryService>()
    nodes.optionalPortOf.mockReturnValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphTurnPolicyService,
            { provide: EntityEngineService, useValue: engine },
            { provide: GraphNodeRegistryService, useValue: nodes },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
        ],
    }).compile()
    return { policy: moduleRef.get(AgentGraphTurnPolicyService), engine }
}

describe("AgentGraphTurnPolicyService: what the customer was already told, from the effect ledger and the stops (D.1)", () => {
    it("a step that runs again is told its earlier lines from the ledger, whatever conversation they went to (a run with none)", async () => {
        const { policy } = await told({
            ledger: { [`${RUN}:match`]: [sendOf("e-1", CHECKING, "c-9", "2026-11-10T03:01:00.000Z")] },
        })

        const turn = await policy.toldOf({ ...ANSWERED, conversationId: null }, "accounting", `${RUN}:match`)

        expect(turn.alreadySent).toEqual([{ text: CHECKING, at: "2026-11-10T03:01:00.000Z" }])
    })

    it("a NEW run of the same customer is told the lines of their open stop, and of a stop resolved within the day", async () => {
        const { policy } = await told({
            conversations: { "c-1": LEAD },
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

    it("finds the customer by the turn's subject when it is one, with no conversation", async () => {
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
            { ...TURN, conversationId: null, subject: { kind: "sales-lead", id: LEAD } },
            "accounting",
            `${RUN}:match`,
        )

        expect(turn.alreadySent).toEqual([{ text: CHECKING, at: "2026-11-10T02:00:00.000Z" }])
    })

    it("on a first try, the step's own ledger records of its open stop are not read (a re-drive is told what its first try was)", async () => {
        const { policy, engine } = await told({
            conversations: { "c-1": LEAD },
            stops: {
                open: [rowOf("s-1", { runId: RUN, stepKey: "answer", customerLines: { lines: [] }, resolvedAt: null })],
            },
            ledger: { [`${RUN}:answer`]: [sendOf("e-1", CHECKING, "c-1", "2026-11-10T02:00:00.000Z")] },
        })

        const turn = await policy.toldOf(TURN, "chatbot", `${RUN}:answer`)

        expect(turn.alreadySent).toBeUndefined()
        expect(engine.list).not.toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ from: "agent.node-effect" }),
            expect.anything(),
        )
    })

    it("tells nothing of a customer with no stop, and reads no stop for a turn with no known customer", async () => {
        const known = await told({ conversations: { "c-1": LEAD } })
        expect((await known.policy.toldOf(TURN, "chatbot", `${RUN}:answer`)).alreadySent).toBeUndefined()

        const unknown = await told({ conversations: { "c-1": null } })
        expect((await unknown.policy.toldOf(TURN, "chatbot", `${RUN}:answer`)).alreadySent).toBeUndefined()
        expect(unknown.engine.list).not.toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ from: "agent.run-stop" }),
            expect.anything(),
        )
    })
})
