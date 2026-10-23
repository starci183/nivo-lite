import { Injectable } from "@nestjs/common"
import { ConnectionSecretsService } from "@modules/domain/connection-secrets"
import type { ConnectionActor } from "@modules/domain/connections"
import { McpConnectorsService } from "@modules/domain/mcp-connectors"
import type { McpEndpoint } from "@modules/integrations/mcp"
import { Secret } from "@modules/platform/config"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { McpGatewayError, McpGatewayErrorCode } from "./errors/mcp-gateway.error"
import type { RemoteTarget } from "./mcp-gateway.contracts"
import { McpGatewayLogEvent } from "./mcp-gateway.log-events"

@Injectable()
/**
 * The bearer of a remote connector: sealed per workspace into the connector's row with the connection key (the connection-secrets
 * cipher, AES-256-GCM under CHANNEL_TOKEN_KEY) and opened only for the request that needs it. The plain value is never stored,
 * logged or read back.
 */
export class McpConnectorCredentialService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        private readonly connectors: McpConnectorsService,
        private readonly secrets: ConnectionSecretsService,
    ) {}

    /**
     * Proves at boot that the connection key opens the bearers already sealed in mcp_connectors (a sample of them, or none): a
     * CHANNEL_TOKEN_KEY overwritten under stored bearers stops the app with `CONNECTION_SECRETS_KEY_MISMATCH` before it serves.
     */
    async assertKeyOpensStored(): Promise<void> {
        this.secrets.assertOpens(await this.connectors.sealedSample())
    }

    /**
     * Seals a bearer the caller already checked and stores it in the connector's row, replacing the one it had; logs who set it,
     * never the value. A key that is not a remote connector of the workspace is refused.
     */
    async store(actor: ConnectionActor, key: string, plain: string): Promise<void> {
        const written = await this.connectors.setCredential({
            workspaceId: actor.workspaceId,
            key,
            sealed: this.secrets.seal(plain),
            setBy: actor.principalId,
        })
        if (!written) throw new McpGatewayError({ code: McpGatewayErrorCode.UnknownTool, params: { tool: key } })
        this.logger.info(McpGatewayLogEvent.BearerSealed, {
            workspaceId: actor.workspaceId,
            connector: key,
            setBy: actor.principalId,
        })
    }

    /**
     * The endpoint of a remote connector with its bearer: none when the server takes no credential, else the credential sealed in
     * the connector's row of this workspace, opened only for this request. A credential not entered yet is refused with
     * `MCP_GATEWAY_CREDENTIAL_MISSING`; one the connection key cannot open (a different CHANNEL_TOKEN_KEY) is logged as an error and
     * refused with `MCP_GATEWAY_CREDENTIAL_UNREADABLE`, never sent half-open.
     */
    async endpointOf(workspaceId: string, target: RemoteTarget): Promise<McpEndpoint> {
        if (target.credentialState === "none") return { url: target.url, bearer: null }
        const stored = await this.connectors.storedCredential(workspaceId, target.key)
        if (stored?.state === "none") return { url: target.url, bearer: null }
        if (stored === null || stored.sealed === null) {
            throw new McpGatewayError({ code: McpGatewayErrorCode.CredentialMissing, params: { key: target.key } })
        }
        const opened = this.secrets.open(stored.sealed)
        if (opened.kind !== "ok") {
            const unreadable = new McpGatewayError({
                code: McpGatewayErrorCode.CredentialUnreadable,
                params: { key: target.key },
            })
            this.logger.error(McpGatewayLogEvent.BearerUnreadable, unreadable, { workspaceId, connector: target.key })
            throw unreadable
        }
        return { url: target.url, bearer: new Secret(opened.value) }
    }
}
