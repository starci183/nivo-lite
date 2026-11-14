import { agentsEntities } from "@modules/domain/agents"
import { EngineDoorService } from "@modules/domain/entity-engine-door"
import { toolCallLogEntities } from "@modules/domain/tool-call-log"
import { toolGrantsEntities } from "@modules/domain/tool-grants"
import { persistGraphTenant, type GraphTenant } from "../../fixtures/builders/agent-graph-world.builder"
import { API_APP_MODULES } from "../../world/api-app.options"
import { backendRoleSandbox } from "../../world/backend-role-sandbox.service"
import { removeAuthUsers, removeWorkspace } from "../../world/proof-accounts.service"
import { useTestWorld } from "../../world/use-test-world"
import { useSeedConnection } from "../../world/sales-door-world.service"

/** The real app opens in about a minute on the world; the whole suite shares that one boot. */
jest.setTimeout(240_000)

const world = useTestWorld({ modules: API_APP_MODULES, sandbox: backendRoleSandbox() })
const seed = useSeedConnection(world)

const who: GraphTenant = {
    workspaceId: world.id(),
    userId: world.id(),
    agentId: world.id(),
    versionId: world.id(),
}

beforeAll(async () => {
    await persistGraphTenant(seed.manager, who)
    world.cleanup(async () => {
        await removeWorkspace(seed.manager, who.workspaceId)
        await removeAuthUsers(seed.manager, [who.userId])
    })
})

/** The most rows a proof reads: far above what one workspace holds here. */
const ROWS_MAX = 20

const [AgentEntity] = agentsEntities
const [ToolGrantEntity] = toolGrantsEntities
const [ToolCallLogEntity] = toolCallLogEntities

/** The seeded nivo agents of the workspace. */
const nivoAgentsOf = (workspaceId: string) =>
    seed.manager.find(AgentEntity, { select: { id: true }, where: { workspaceId, module: "nivo" }, take: ROWS_MAX })

/** The grants of the seeded nivo agent, by tool. */
const grantsOf = async (workspaceId: string, agentId: string) =>
    (
        await seed.manager.find(ToolGrantEntity, {
            select: { tool: true, mode: true },
            where: { workspaceId, agentId },
            order: { tool: "ASC" },
            take: ROWS_MAX,
        })
    ).map(({ tool, mode }) => ({ tool, mode }))

/** The door of a job run the way the job runner opens it: the workspace, the job run, the module agent when the job reaches records. */
const doorOf = (agentId: string | undefined) => {
    const jobId = world.id()
    return world.resolve(EngineDoorService).doorApi({
        workspaceId: who.workspaceId,
        jobId,
        agentId,
        effectKey: (step) => `${jobId}:${step}`,
        scopeOpen: () => false,
    })
}

describe("the internal nivo agent of a workspace", () => {
    it("is laid down with the workspace row, and the baseline's grant rows are the ones the declared jobs held (the customer send no longer reads its row)", async () => {
        const agents = await nivoAgentsOf(who.workspaceId)
        expect(agents).toHaveLength(1)
        expect(await grantsOf(who.workspaceId, String(agents[0]?.id))).toEqual([
            { tool: "nivo.tool.chat.profile.get", mode: "auto" },
            { tool: "nivo.tool.chat.send", mode: "auto" },
            { tool: "nivo.tool.ledger.entry.append", mode: "auto" },
            { tool: "nivo.tool.ledger.status.get", mode: "auto" },
        ])
    })

    it("refuses the customer send of a job whose module has no installed agent, and reaches no gateway", async () => {
        const [nivo] = await nivoAgentsOf(who.workspaceId)
        const result = await doorOf(undefined).call("nivo.tool.customer.message.send", { contactId: world.id(), text: "Xin chao" })
        expect(result).toEqual({ ok: false, reason: "forbidden", message: "no_agent" })
        const logged = await seed.manager.count(ToolCallLogEntity, { where: { workspaceId: who.workspaceId, agentId: String(nivo?.id) } })
        expect(logged).toBe(0)
    })

    it("lets a declared job tell a person through the one send tool as its module agent: the call is judged and logged under that agent, and a person the workspace does not know is answered as a refusal fact", async () => {
        const result = await doorOf(who.agentId).call(
            "nivo.tool.customer.message.send",
            { contactId: world.id(), text: "Shop mo cua tu 8 gio sang." },
            { onceBy: world.id() },
        )
        expect(result).toMatchObject({ ok: true, output: { kind: "refused", id: "no_recipient" } })
        const logged = await seed.manager.find(ToolCallLogEntity, {
            select: { connector: true, tool: true },
            where: { workspaceId: who.workspaceId, agentId: who.agentId },
            take: ROWS_MAX,
        })
        expect(logged.map(({ connector, tool }) => ({ connector, tool }))).toEqual([
            { connector: "customer", tool: "nivo.tool.customer.message.send" },
        ])
    })

    it("denies a door tool no job holds, as before", async () => {
        const result = await doorOf(who.agentId).call("nivo.tool.ledger.entry.void", { a: 1 })
        expect(result).toEqual({ ok: false, reason: "forbidden", message: "not_granted" })
    })
})
