import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import type { PageRow } from "@nivo-lite/agent-sdk/entity/port"
import { queryProblems } from "@nivo-lite/agent-sdk/query"
import type { Query } from "@nivo-lite/agent-sdk/query"
import { FLOW_F_ENTITIES } from "@nivo-lite/blocks-core/entities"
import { MODULE_DECLARATIONS, agentGuidanceOf } from "@nivo-lite/blocks-core/modules"
import { EntityEngineService } from "@modules/domain/entity-engine"
import type { ScopedTx } from "@modules/domain/entity-engine"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeDataPort, NodeTurn } from "@modules/domain/graph-nodes"
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
