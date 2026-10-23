import { Injectable } from "@nestjs/common"
import type { OnApplicationBootstrap } from "@nestjs/common"
import { ConnectionSecretsService } from "@modules/domain/connection-secrets"
import { McpConnectorCredentialService } from "./mcp-connector-credential.service"

@Injectable()
/**
 * The boot guard of the one connection key (CHANNEL_TOKEN_KEY), composed by the apps that serve (api, mcp): before they serve, the
 * key must open a credential already sealed with it, in connection_secrets and in mcp_connectors. A key overwritten under stored
 * credentials stops the app with `CONNECTION_SECRETS_KEY_MISMATCH`, so a replaced key never goes live; with nothing sealed yet any
 * valid key passes.
 */
export class ConnectionKeyCheckService implements OnApplicationBootstrap {
    constructor(
        private readonly secrets: ConnectionSecretsService,
        private readonly credentials: McpConnectorCredentialService,
    ) {}

    /** Proves the key against the stored credentials; a mismatch rejects the app's start. */
    async onApplicationBootstrap(): Promise<void> {
        await this.secrets.assertKeyOpensStored()
        await this.credentials.assertKeyOpensStored()
    }
}
