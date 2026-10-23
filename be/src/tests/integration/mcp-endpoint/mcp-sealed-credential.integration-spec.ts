import { randomBytes } from "node:crypto"
import { McpGatewayAdminService, McpGatewayService } from "@modules/domain/mcp-gateway"
import { Secret } from "@modules/platform/config"
import { persistMcpAgentRows } from "../../fixtures/builders/mcp-agent.builder"
import {
    GRANT_CONNECTOR_TOOLS,
    MCP_CALLS_OF_AGENT,
    STORED_CREDENTIAL_OF,
} from "../../fixtures/persistence/mcp-agent.sql"
import { MCP_SEALED_CREDENTIAL_MODULES } from "../../world/mcp-sealed-credential-capabilities.options"
import { createRemoteServer } from "../../world/mcp-remote-server.service"
import { cleanupWorkspace } from "../../world/proof-database.service"
import { useTestWorld } from "../../world/use-test-world"

/** One stored credential row, as the database holds it. */
interface StoredRow {
    readonly credential_state: string
    readonly credential_sealed: string | null
    readonly credential_set_by: string | null
}

const world = useTestWorld({ modules: MCP_SEALED_CREDENTIAL_MODULES })

const identity = { userId: world.id(), workspaceId: world.id(), agentId: world.id() }
const owner = { principalId: identity.userId, workspaceId: identity.workspaceId }
const caller = {
    workspaceId: identity.workspaceId,
    agentId: identity.agentId,
    conversationId: null,
    workItemId: null,
}
/** The credential the remote server accepts: random per run, never a deployed value; the rotation proof replaces it. */
const bearer = { accepted: randomBytes(24).toString("hex") }
const server = createRemoteServer(() => bearer.accepted)

const stored = async (): Promise<StoredRow | undefined> =>
    (await world.db.primary.query<Array<StoredRow>>(STORED_CREDENTIAL_OF, [identity.workspaceId, "proof"]))[0]

beforeAll(async () => {
    cleanupWorkspace(world, identity.userId, identity.workspaceId)
    await persistMcpAgentRows(world.db.primary, identity)
    await world.db.primary.query(GRANT_CONNECTOR_TOOLS, [identity.workspaceId, identity.agentId, "proof.*"])
    await server.listen()
})

afterAll(async () => {
    await server.close()
})

describe("MCP gateway with a credential sealed in the database: register and call", () => {
    it("seals the credential an owner registers, never stores it in clear, and reads the catalog with it", async () => {
        const admin = world.resolve(McpGatewayAdminService)

        await admin.registerRemote(owner, {
            key: "proof",
            name: "Sealed proof",
            url: server.url,
            credential: bearer.accepted,
            contractVersion: "proof-mcp@1",
        })

        const row = await stored()
        expect(row?.credential_state).toBe("set")
        expect(row?.credential_set_by).toBe(identity.userId)
        expect(row?.credential_sealed).toEqual(expect.any(String))
        expect(row?.credential_sealed).not.toContain(bearer.accepted)
        expect(server.seen.authorized).toBeGreaterThan(0)
        expect(server.seen.refused).toBe(0)
        const views = await admin.connectors(owner)
        const view = views.find((connector) => connector.key === "proof")
        expect(view).toMatchObject({ credentialState: "set", tools: [{ name: "proof.rates.quote", approved: false }] })
        expect(JSON.stringify(views)).not.toContain(bearer.accepted)
    })

    it("refuses the unapproved tool, then calls the connector with the opened credential once the owner approves", async () => {
        const gateway = world.resolve(McpGatewayService)

        await expect(gateway.call(caller, "proof.rates.quote", { nights: 2 })).resolves.toMatchObject({
            ok: false,
            code: "schema_unapproved",
        })
        await expect(world.resolve(McpGatewayAdminService).approveCatalog(owner, "proof")).resolves.toBe(1)
        const before = server.seen.authorized

        await expect(gateway.call(caller, "proof.rates.quote", { nights: 2 })).resolves.toEqual({
            ok: true,
            value: { totalVnd: 2_400_000 },
        })
        expect(server.seen.authorized).toBeGreaterThan(before)
        expect(server.seen.calls).toEqual([{ nights: 2 }])
        await expect(world.db.primary.query(MCP_CALLS_OF_AGENT, [identity.agentId])).resolves.toEqual(
            expect.arrayContaining([{ tool: "proof.rates.quote", outcome: "ok" }]),
        )
    })
})

describe("MCP gateway with a credential sealed in the database: rotation and roles", () => {
    it("follows a rotation: the old sealed credential is refused by the server, the rotated one is used", async () => {
        const admin = world.resolve(McpGatewayAdminService)
        const gateway = world.resolve(McpGatewayService)
        const previous = (await stored())?.credential_sealed
        bearer.accepted = randomBytes(24).toString("hex")

        await expect(gateway.call(caller, "proof.rates.quote", { nights: 1 })).resolves.toMatchObject({
            ok: false,
            code: "unavailable",
        })
        expect(server.seen.refused).toBeGreaterThan(0)
        await expect(
            admin.setCredential(owner, { key: "proof", credential: new Secret(bearer.accepted) }),
        ).resolves.toBe(1)
        expect((await stored())?.credential_sealed).not.toBe(previous)

        await expect(gateway.call(caller, "proof.rates.quote", { nights: 3 })).resolves.toEqual({
            ok: true,
            value: { totalVnd: 3_600_000 },
        })
    })

    it("refuses a person who does not manage connections before anything is sealed", async () => {
        const admin = world.resolve(McpGatewayAdminService)
        const stranger = { principalId: world.id(), workspaceId: identity.workspaceId }
        const before = (await stored())?.credential_sealed

        await expect(
            admin.setCredential(stranger, { key: "proof", credential: new Secret("not-allowed") }),
        ).rejects.toMatchObject({ code: "CONNECTIONS_FORBIDDEN" })
        expect((await stored())?.credential_sealed).toBe(before)
    })
})
