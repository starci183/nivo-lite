import { ChatConversationsService, ChatMessagesService } from "@modules/domain/chat-records"
import { agentsEntities } from "@modules/domain/agents"
import { ModuleJobRunnerService } from "@modules/domain/entity-engine"
import { JobRetry } from "@nivo-lite/agent-sdk/mutation"
import { mcpCallLogEntities } from "@modules/domain/mcp-call-log"
import { mcpToolGrantsEntities } from "@modules/domain/mcp-tool-grants"
import { persistGraphTenant } from "../../fixtures/builders/agent-graph-world.builder"
import type { GraphTenant } from "../../fixtures/builders/agent-graph-world.builder"
import { API_APP_MODULES } from "../../world/api-app.options"
import { backendRoleSandbox } from "../../world/backend-role-sandbox.service"
import { removeAuthUsers, removeWorkspace } from "../../world/proof-accounts.service"
import { useTestWorld } from "../../world/use-test-world"
import { bindJobDoor } from "../../world/nivo-door-proof.service"
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
const [McpToolGrantEntity] = mcpToolGrantsEntities
const [McpCallLogEntity] = mcpCallLogEntities

/** The seeded nivo agents of the workspace. */
const nivoAgentsOf = (workspaceId: string) =>
    seed.manager.find(AgentEntity, { select: { id: true }, where: { workspaceId, module: "nivo" }, take: ROWS_MAX })

/** The grants of the seeded nivo agent, by tool. */
const grantsOf = async (workspaceId: string, agentId: string) =>
    (
        await seed.manager.find(McpToolGrantEntity, {
            select: { tool: true, mode: true },
            where: { workspaceId, agentId },
            order: { tool: "ASC" },
            take: ROWS_MAX,
        })
    ).map(({ tool, mode }) => ({ tool, mode }))

describe("the internal nivo agent of a workspace", () => {
    it("is laid down with the workspace row and holds exactly the door grants of the declared jobs", async () => {
        const agents = await nivoAgentsOf(who.workspaceId)
        expect(agents).toHaveLength(1)
        expect(await grantsOf(who.workspaceId, String(agents[0]?.id))).toEqual([
            { tool: "nivo.chat.profile.get", mode: "auto" },
            { tool: "nivo.chat.send", mode: "auto" },
            { tool: "nivo.ledger.entry.append", mode: "auto" },
            { tool: "nivo.ledger.status.get", mode: "auto" },
        ])
    })

    it("passes the grant check of the gateway for a declared job's door call, and the call log names the agent", async () => {
        bindJobDoor(world)
        const met = await world.resolve(ChatConversationsService).meet({
            workspaceId: who.workspaceId,
            agentId: who.agentId,
            channel: "website",
            customerId: world.id(),
            visitor: "Lan",
            connectionId: world.id(),
        })
        const heard = await world
            .resolve(ChatMessagesService)
            .storeCustomer(who.workspaceId, met.conversation.id, "Shop mo cua may gio?", null, null)
        const reply = await world.resolve(ChatMessagesService).storeAgentLine({
            workspaceId: who.workspaceId,
            conversationId: met.conversation.id,
            body: "Shop mo cua tu 8 gio sang.",
            key: `reply:${heard.id}`,
            inReplyTo: heard.id,
        })

        const delivery = {
            jobId: world.id(),
            kind: "chatbot.deliver-reply",
            fencingToken: 1,
            currentStep: null,
            payload: { job: "chatbot.deliver-reply", workspaceId: who.workspaceId, input: { messageId: reply.id } },
        }
        const runner = world.resolve(ModuleJobRunnerService)
        // The chat tool marks the line sent itself, so the job's own write of the old version asks the queue for one more delivery.
        await expect(runner.run(delivery)).rejects.toBeInstanceOf(JobRetry)
        await expect(runner.run(delivery)).resolves.toBeUndefined()

        const [nivo] = await nivoAgentsOf(who.workspaceId)
        const logged = await seed.manager.find(McpCallLogEntity, {
            select: { connector: true, tool: true, outcome: true },
            where: { workspaceId: who.workspaceId, agentId: String(nivo?.id) },
            take: ROWS_MAX,
        })
        expect(logged.map(({ connector, tool, outcome }) => ({ connector, tool, outcome }))).toEqual([
            { connector: "chat", tool: "nivo.chat.send", outcome: "ok" },
        ])
        const stored = await world.resolve(ChatMessagesService).storeAgentLine({
            workspaceId: who.workspaceId,
            conversationId: met.conversation.id,
            body: "Shop mo cua tu 8 gio sang.",
            key: `reply:${heard.id}`,
            inReplyTo: heard.id,
        })
        expect(stored).toMatchObject({ id: reply.id, sent: true })
    })
})
