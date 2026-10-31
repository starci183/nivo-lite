import type { GraphDocument } from "@modules/domain/agent-graphs"
import { ApiKeysService } from "@modules/domain/api-keys"
import { GatewaySurfaceService } from "@modules/domain/mcp-gateway"
import { OWNER_EXAMPLE, graphOf } from "../../fixtures/builders/agent-graph.builder"
import { persistGraph } from "../../fixtures/builders/agent-graph-world.builder"
import { persistMcpAgentRows } from "../../fixtures/builders/mcp-agent.builder"
import { grantTool, persistActiveFact, storedCallsOf } from "../../fixtures/builders/native-tools.builder"
import { NATIVE_TOOLS_MODULES } from "../../world/native-tools-capabilities.options"
import { cleanupWorkspace } from "../../world/proof-database.service"
import { useTestWorld } from "../../world/use-test-world"

const world = useTestWorld({ modules: NATIVE_TOOLS_MODULES })

/** One tenant: its owner, workspace and agent; a staff-facing agent reads with no conversation, a chatbot faces customers. */
const tenant = () => ({ userId: world.id(), workspaceId: world.id(), agentId: world.id() })
type Tenant = ReturnType<typeof tenant>

/** Calls a tool through the endpoint's service as the agent the credential names, in its own workspace. */
const call = (who: Tenant, name: string, args: Record<string, unknown>) =>
    world.resolve(GatewaySurfaceService).answer({
        workspaceId: who.workspaceId,
        principal: { agentId: who.agentId, workspaceId: who.workspaceId },
        message: {
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: { name: "tool.call", arguments: { name, arguments: args } },
        },
    })

/** Gives the agent a graph whose active version holds these rights, in the mode named. */
const govern = async (who: Tenant, rights: GraphDocument["rights"], mode: "shadow" | "enforced") => {
    await persistGraph(world.db.primary, { ...who, versionId: world.id() }, { ...graphOf(OWNER_EXAMPLE), rights }, mode)
}

/** An agent of the module named, with its key, one public fact in its Brain and the grant to search it. */
const arrange = async (who: Tenant, module: string) => {
    cleanupWorkspace(world, who.userId, who.workspaceId)
    await persistMcpAgentRows(world.db.primary, { ...who, module })
    await world.resolve(ApiKeysService).createKey(who.userId, who.workspaceId, "Desk agent", who.agentId)
    await persistActiveFact(world.db.primary, {
        workspaceId: who.workspaceId,
        subject: "Shop",
        attribute: "Opening hours",
        value: "8 to 21 every day",
        scope: "public",
    })
    await grantTool(world.db.primary, who.workspaceId, who.agentId, "brain.search")
}

const search = (who: Tenant) => call(who, "brain.search", { query: "opening hours" })

describe("agent-graph/rights: the data rights of an agent at the gateway", () => {
    const chatbot = tenant()
    const shadowed = tenant()
    const closed = tenant()
    const granted = tenant()
    const hidden = tenant()

    beforeAll(async () => {
        await arrange(chatbot, "chatbot")
        await Promise.all([shadowed, closed, granted, hidden].map((who) => arrange(who, "accounting")))
    })

    it("agent-graph/rights-shadow-open: a graph that only records leaves the reads as they were", async () => {
        await govern(shadowed, [], "shadow")

        const reply = await search(shadowed)

        expect(reply.body).toMatchObject({ result: { isError: false } })
        expect(JSON.stringify(reply.body)).toContain("8 to 21 every day")
    })

    it("agent-graph/rights-default-deny: an enforced graph with no right on a kind refuses the read and audits it", async () => {
        await govern(closed, [], "enforced")

        const reply = await search(closed)

        expect(reply.body).toMatchObject({ result: { isError: true } })
        expect(JSON.stringify(reply.body)).toContain("no_data_right")
        await expect(storedCallsOf(world.db.primary, closed.agentId, "brain.search")).resolves.toEqual([
            expect.objectContaining({ outcome: "refused" }),
        ])
    })

    it("agent-graph/rights-outsider: an agent that faces customers reads nothing without a conversation, whatever its right says", async () => {
        await govern(chatbot, [{ kind: "brain", scope: "workspace", hide: [], mask: [] }], "enforced")

        const reply = await search(chatbot)

        expect(reply.body).toMatchObject({ result: { isError: true } })
        expect(JSON.stringify(reply.body)).toContain("no_data_right")
        expect(JSON.stringify(reply.body)).not.toContain("8 to 21 every day")
    })

    it("agent-graph/rights-grant: a staff agent with a right on the kind reads it", async () => {
        await govern(granted, [{ kind: "brain", scope: "workspace", hide: [], mask: [] }], "enforced")

        const reply = await search(granted)

        expect(reply.body).toMatchObject({ result: { isError: false } })
        expect(JSON.stringify(reply.body)).toContain("8 to 21 every day")
    })

    it("agent-graph/rights-hide: a staff agent with a right reads the kind, minus the fields the right hides", async () => {
        await govern(hidden, [{ kind: "brain", scope: "workspace", hide: ["value"], mask: [] }], "enforced")

        const reply = await search(hidden)

        expect(reply.body).toMatchObject({ result: { isError: false } })
        expect(JSON.stringify(reply.body)).not.toContain("8 to 21 every day")
    })
})
