import { AgentAccessLogModule, AgentAccessLogService, agentAccessLogEntities, BOUND } from "@modules/domain/agent-access-log"
import { agentsEntities } from "@modules/domain/agents"
import { useTestWorld } from "@tests/world/use-test-world"
import { persistProofAccount } from "@tests/world/account-data-atomic-proof.service"

const [AgentAccessLogEntity] = agentAccessLogEntities
const [AgentEntity] = agentsEntities

// The access log on the REAL database: every value the binding writer records must pass the table's own check constraints. The unit
// specs fake the store (any string passes), which is how a binding that wrote a value the constraint refused reached dev (MX-CORE D2-1).

const world = useTestWorld({ modules: [AgentAccessLogModule.register({ isGlobal: true })] })
const log = (): AgentAccessLogService => world.resolve(AgentAccessLogService)

describe("agent_access_log on the real database", () => {
    it("keeps a binding made and a binding removed, the two changes of access the rights model has", async () => {
        const { workspaceId, connectionId } = await persistProofAccount(world, "zalo_oa")
        const agentId = world.id()
        await world.db.primary.insert(AgentEntity, {
            id: agentId,
            workspaceId,
            name: "Chatbot",
            handle: "chatbot",
            module: "chatbot",
            role: "Answers the account's customers",
            instructions: "Answer.",
        })
        world.cleanup(async () => {
            await world.db.primary.delete(AgentAccessLogEntity, { workspaceId })
            await world.db.primary.delete(AgentEntity, { id: agentId })
        })
        const change = {
            workspaceId,
            connectionId,
            agentId,
            connectionName: "Zalo",
            agentName: "Chatbot",
            changedBy: world.id(),
            changedByName: "Owner",
        }
        await log().record({ ...change, before: null, after: BOUND })
        await log().record({ ...change, before: BOUND, after: null })

        const rows = await world.db.primary.find(AgentAccessLogEntity, { where: { workspaceId }, order: { createdAt: "ASC" } })
        expect(rows.map((row) => [row.beforeAccess, row.afterAccess])).toEqual([
            [null, "bound"],
            ["bound", null],
        ])
    })
})
