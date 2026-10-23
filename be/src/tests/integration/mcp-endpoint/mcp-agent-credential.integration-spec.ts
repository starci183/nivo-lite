import type { ExecutionContext } from "@nestjs/common"
import { mock } from "@starci/jest-preset"
import { ApiKeysService } from "@modules/domain/api-keys"
import { AuthGuard, Credential, CredentialGuard } from "@modules/domain/identity"
import type { CredentialPrincipal } from "@modules/domain/identity"
import { GatewaySurfaceService } from "@modules/domain/mcp-gateway"
import { ERRORS_SERVICE } from "@modules/platform/errors"
import type { ErrorsService } from "@modules/platform/errors"
import type { OperationRequest } from "@modules/platform/http-security"
import { persistMcpAgentRows } from "../../fixtures/builders/mcp-agent.builder"
import { DELETE_AGENT, MCP_CALLS_OF_AGENT } from "../../fixtures/persistence/mcp-agent.sql"
import { MCP_CREDENTIAL_MODULES } from "../../world/mcp-credential-capabilities.options"
import { cleanupWorkspace } from "../../world/proof-database.service"
import { useTestWorld } from "../../world/use-test-world"

/** The door of the mcp app's endpoint, with the same credential metadata as its controller. */
@Credential({ kind: "tool-token", workflow: "mcp-gateway" })
class McpEndpointDoor {}

const world = useTestWorld({ modules: MCP_CREDENTIAL_MODULES })

/** Runs the app's guard chain (CredentialGuard, then AuthGuard) for one request to the endpoint door. */
const admit = async (authorization: string | undefined) => {
    const request = mock<OperationRequest>({ headers: { authorization }, principal: undefined })
    const http = mock<ReturnType<ExecutionContext["switchToHttp"]>>()
    http.getRequest.mockReturnValue(request)
    const context = mock<ExecutionContext>()
    context.getHandler.mockReturnValue(() => undefined)
    context.getClass.mockReturnValue(McpEndpointDoor)
    context.switchToHttp.mockReturnValue(http)
    const passed =
        (await world.resolve(CredentialGuard).canActivate(context)) &&
        (await world.resolve(AuthGuard).canActivate(context))
    return { passed, principal: request.credentialPrincipal }
}

/** The HTTP status the app's error filter answers for a refusal. */
const statusOf = async (authorization: string | undefined): Promise<number> => {
    const failure: unknown = await admit(authorization).then(
        () => undefined,
        (cause: unknown) => cause,
    )
    return world.resolve<ErrorsService>(ERRORS_SERVICE).describe(failure).status
}

const callBankTool = (workspaceId: string, principal: CredentialPrincipal) =>
    world.resolve(GatewaySurfaceService).answer({
        workspaceId,
        principal: { agentId: principal.subject, workspaceId: principal.workspaceId },
        message: {
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: { name: "tool.call", arguments: { name: "sepay.transactions.list", arguments: { limit: 5 } } },
        },
    })

describe("MCP endpoint per-agent credential", () => {
    const identity = { userId: world.id(), workspaceId: world.id(), agentId: world.id() }
    let agentKey = ""

    beforeAll(async () => {
        cleanupWorkspace(world, identity.userId, identity.workspaceId)
        await persistMcpAgentRows(world.db.primary, identity)
        const created = await world
            .resolve(ApiKeysService)
            .createKey(identity.userId, identity.workspaceId, "Desk agent", identity.agentId)
        agentKey = created.key
    })

    it("lets the agent key through as its agent and the call reaches the granted tool", async () => {
        const { passed, principal } = await admit(`Bearer ${agentKey}`)

        expect(passed).toBe(true)
        expect(principal).toEqual({ kind: "tool-token", subject: identity.agentId, workspaceId: identity.workspaceId })
        const reply = await callBankTool(identity.workspaceId, {
            kind: "tool-token",
            subject: identity.agentId,
            workspaceId: identity.workspaceId,
        })
        expect(reply.body).toMatchObject({ jsonrpc: "2.0", id: 1, result: { isError: false } })
        await expect(world.db.primary.query(MCP_CALLS_OF_AGENT, [identity.agentId])).resolves.toEqual([
            { tool: "sepay.transactions.list", outcome: "ok" },
        ])
    })

    it("answers 401 to a request without a key and to a key no workspace issued", async () => {
        await expect(statusOf(undefined)).resolves.toBe(401)
        await expect(statusOf("Bearer nvk_not-a-key")).resolves.toBe(401)
    })

    it("answers 401 to a revoked key", async () => {
        const revoked = await world
            .resolve(ApiKeysService)
            .createKey(identity.userId, identity.workspaceId, "Old desk agent", identity.agentId)
        await world.resolve(ApiKeysService).revokeKey(identity.userId, identity.workspaceId, revoked.item.id)

        await expect(statusOf(`Bearer ${revoked.key}`)).resolves.toBe(401)
    })

    it("answers 401 once the agent is deleted, its key going with it", async () => {
        await world.db.primary.query(DELETE_AGENT, [identity.agentId])

        await expect(statusOf(`Bearer ${agentKey}`)).resolves.toBe(401)
    })
})
