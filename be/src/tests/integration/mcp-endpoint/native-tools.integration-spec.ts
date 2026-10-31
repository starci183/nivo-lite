import { ApiKeysService } from "@modules/domain/api-keys"
import { GatewaySurfaceService } from "@modules/domain/mcp-gateway"
import { grantTool, persistBrainScenario, storedCallsOf } from "../../fixtures/builders/native-tools.builder"
import { persistMcpAgentRows } from "../../fixtures/builders/mcp-agent.builder"
import { NATIVE_TOOLS_MODULES } from "../../world/native-tools-capabilities.options"
import { cleanupWorkspace } from "../../world/proof-database.service"
import { useTestWorld } from "../../world/use-test-world"

const world = useTestWorld({ modules: NATIVE_TOOLS_MODULES })

/** One tenant: its owner, workspace and agent (a customer-facing chatbot, so its Brain view is the public one). */
const tenant = () => ({ userId: world.id(), workspaceId: world.id(), agentId: world.id() })

/** Calls a tool through the endpoint's service as the agent the credential names, in its own workspace. */
const call = (who: ReturnType<typeof tenant>, name: string, args: Record<string, unknown>, opKey?: string) =>
    world.resolve(GatewaySurfaceService).answer({
        workspaceId: who.workspaceId,
        principal: { agentId: who.agentId, workspaceId: who.workspaceId },
        message: {
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: { name: "tool.call", arguments: { name, arguments: args, ...(opKey === undefined ? {} : { opKey }) } },
        },
    })

describe("NIVO MCP native Brain tools", () => {
    const own = tenant()
    const other = tenant()

    beforeAll(async () => {
        await Promise.all(
            [own, other].map(async (who) => {
                cleanupWorkspace(world, who.userId, who.workspaceId)
                await persistMcpAgentRows(world.db.primary, who)
                await world.resolve(ApiKeysService).createKey(who.userId, who.workspaceId, "Desk agent", who.agentId)
            }),
        )
        await persistBrainScenario(world.db.primary, own, other)
    })

    it("reads a public fact of its own workspace and nothing internal or foreign", async () => {
        const reply = await call(own, "brain.search", { query: "opening hours" })

        const text = JSON.stringify(reply.body)
        expect(reply.body).toMatchObject({ result: { isError: false } })
        expect(text).toContain("8 to 21 every day")
        expect(text).not.toContain("9 to 17 weekdays")
        expect(text).not.toContain("40 percent")
    })

    it("answers another workspace from its own facts alone", async () => {
        const reply = await call(other, "brain.search", { query: "opening hours" })

        const text = JSON.stringify(reply.body)
        expect(text).toContain("9 to 17 weekdays")
        expect(text).not.toContain("8 to 21 every day")
    })

    it("keeps the question out of the audit line it writes, and the values out of its summary", async () => {
        await call(own, "brain.search", { query: "secret margin question" })

        const lines = await storedCallsOf(world.db.primary, own.agentId, "brain.search")

        expect(lines.length).toBeGreaterThan(0)
        for (const line of lines) {
            expect(line.outcome).toBe("ok")
            expect(line.argsMasked).toContain('"query":"***"')
            expect(line.argsMasked).not.toContain("secret margin question")
            expect(line.resultSummary).not.toContain("8 to 21 every day")
        }
    })

    it("answers not granted for a tool the agent holds no grant on, and audits the refusal", async () => {
        // A call that names its operation reaches the gateway, which audits the refusal; one that does not is answered by the surface
        // as "not granted or unknown" before the gateway, so a probe for tool names leaves no line.
        const reply = await call(own, "brain.facts.list", {}, "probe-1")

        expect(reply.body).toMatchObject({ result: { isError: true } })
        expect(JSON.stringify(reply.body)).toContain("not_granted")
        await expect(storedCallsOf(world.db.primary, own.agentId, "brain.facts.list")).resolves.toEqual([
            expect.objectContaining({ outcome: "refused" }),
        ])
    })

    it("answers not found, an answer and not a failure, for a fact the view does not hold", async () => {
        await grantTool(world.db.primary, own.workspaceId, own.agentId, "brain.facts.get")

        const reply = await call(own, "brain.facts.get", { id: "00000000-0000-4000-8000-000000000000" })

        expect(JSON.stringify(reply.body)).toContain("not_found")
    })
})
