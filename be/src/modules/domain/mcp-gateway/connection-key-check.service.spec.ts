import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import {
    ConnectionSecretsError,
    ConnectionSecretsErrorCode,
    ConnectionSecretsService,
} from "@modules/domain/connection-secrets"
import { ConnectionKeyCheckService } from "./connection-key-check.service"
import { McpConnectorCredentialService } from "./mcp-connector-credential.service"

const build = async () => {
    const secrets = mock<ConnectionSecretsService>()
    const credentials = mock<McpConnectorCredentialService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ConnectionKeyCheckService,
            { provide: ConnectionSecretsService, useValue: secrets },
            { provide: McpConnectorCredentialService, useValue: credentials },
        ],
    }).compile()
    return { check: moduleRef.get(ConnectionKeyCheckService), secrets, credentials }
}

describe("ConnectionKeyCheckService", () => {
    it("proves the connection key against the sealed connection credentials and the sealed connector bearers at boot", async () => {
        const { check, secrets, credentials } = await build()

        await expect(check.onApplicationBootstrap()).resolves.toBeUndefined()

        expect(secrets.assertKeyOpensStored).toHaveBeenCalledTimes(1)
        expect(credentials.assertKeyOpensStored).toHaveBeenCalledTimes(1)
    })

    it("stops the boot with CONNECTION_SECRETS_KEY_MISMATCH when the key was overwritten under stored credentials", async () => {
        const { check, secrets, credentials } = await build()
        const mismatch = new ConnectionSecretsError({ code: ConnectionSecretsErrorCode.KeyMismatch })
        secrets.assertKeyOpensStored.mockRejectedValue(mismatch)

        await expect(check.onApplicationBootstrap()).rejects.toMatchObject({
            code: ConnectionSecretsErrorCode.KeyMismatch,
        })
        expect(credentials.assertKeyOpensStored).not.toHaveBeenCalled()
    })
})
