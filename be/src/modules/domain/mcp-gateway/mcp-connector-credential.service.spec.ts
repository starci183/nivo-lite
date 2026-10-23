import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import {
    ConnectionSecretsError,
    ConnectionSecretsErrorCode,
    ConnectionSecretsService,
} from "@modules/domain/connection-secrets"
import { McpConnectorsService } from "@modules/domain/mcp-connectors"
import { Secret } from "@modules/platform/config"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { McpGatewayErrorCode } from "./errors/mcp-gateway.error"
import { McpConnectorCredentialService } from "./mcp-connector-credential.service"
import { McpGatewayLogEvent } from "./mcp-gateway.log-events"

const ACTOR = { principalId: "person-1", workspaceId: "ws-1" }
/** The sealed text of the remote connector of these specs. */
const SEALED = "sealed-hakuen"
const TARGET = { key: "hakuen", url: "https://hakuen.test/mcp" }

const build = async () => {
    const logger = mock<Logger>()
    const connectors = mock<McpConnectorsService>()
    connectors.setCredential.mockResolvedValue(true)
    connectors.storedCredential.mockResolvedValue({ state: "set", sealed: SEALED })
    const secrets = mock<ConnectionSecretsService>()
    secrets.seal.mockImplementation((plain) => `sealed(${plain.length})`)
    secrets.open.mockImplementation((sealed) =>
        sealed === SEALED
            ? { kind: "ok", value: "bearer-1" }
            : { kind: "refused", code: ConnectionSecretsErrorCode.Unreadable },
    )
    const moduleRef = await Test.createTestingModule({
        providers: [
            McpConnectorCredentialService,
            { provide: LOGGER, useValue: logger },
            { provide: McpConnectorsService, useValue: connectors },
            { provide: ConnectionSecretsService, useValue: secrets },
        ],
    }).compile()
    return { credentials: moduleRef.get(McpConnectorCredentialService), logger, connectors, secrets }
}

describe("McpConnectorCredentialService.store", () => {
    it("seals the bearer with the connection key into the connector's row and logs who set it, never the value", async () => {
        const { credentials, connectors, secrets, logger } = await build()

        await credentials.store(ACTOR, "hakuen", "bearer-1")

        expect(secrets.seal).toHaveBeenCalledWith("bearer-1")
        expect(connectors.setCredential).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            key: "hakuen",
            sealed: "sealed(8)",
            setBy: "person-1",
        })
        expect(logger.info).toHaveBeenCalledWith(McpGatewayLogEvent.BearerSealed, {
            workspaceId: "ws-1",
            connector: "hakuen",
            setBy: "person-1",
        })
        expect(JSON.stringify([...logger.info.mock.calls, ...connectors.setCredential.mock.calls])).not.toContain(
            "bearer-1",
        )
    })

    it("refuses a key that is not a remote connector of the workspace", async () => {
        const { credentials, connectors, logger } = await build()
        connectors.setCredential.mockResolvedValue(false)

        await expect(credentials.store(ACTOR, "sepay", "x")).rejects.toMatchObject({
            code: McpGatewayErrorCode.UnknownTool,
            params: { tool: "sepay" },
        })
        expect(logger.info).not.toHaveBeenCalled()
    })
})

describe("McpConnectorCredentialService.endpointOf", () => {
    it("sends no bearer to a server that takes none, without reading any credential", async () => {
        const { credentials, connectors } = await build()

        await expect(credentials.endpointOf("ws-1", { ...TARGET, credentialState: "none" })).resolves.toEqual({
            url: "https://hakuen.test/mcp",
            bearer: null,
        })
        expect(connectors.storedCredential).not.toHaveBeenCalled()
    })

    it("opens the sealed bearer of the workspace row, and sends none when the row now takes none", async () => {
        const { credentials, connectors, secrets } = await build()

        await expect(credentials.endpointOf("ws-1", { ...TARGET, credentialState: "set" })).resolves.toEqual({
            url: "https://hakuen.test/mcp",
            bearer: new Secret("bearer-1"),
        })
        expect(connectors.storedCredential).toHaveBeenCalledWith("ws-1", "hakuen")
        expect(secrets.open).toHaveBeenCalledWith(SEALED)
        connectors.storedCredential.mockResolvedValue({ state: "none", sealed: null })
        await expect(credentials.endpointOf("ws-1", { ...TARGET, credentialState: "set" })).resolves.toEqual({
            url: "https://hakuen.test/mcp",
            bearer: null,
        })
    })

    it("refuses a bearer not entered yet and a missing row as missing", async () => {
        const { credentials, connectors } = await build()

        connectors.storedCredential.mockResolvedValue({ state: "needed", sealed: null })
        await expect(credentials.endpointOf("ws-1", { ...TARGET, credentialState: "needed" })).rejects.toMatchObject({
            code: McpGatewayErrorCode.CredentialMissing,
            params: { key: "hakuen" },
        })
        connectors.storedCredential.mockResolvedValue(null)
        await expect(credentials.endpointOf("ws-1", { ...TARGET, credentialState: "set" })).rejects.toMatchObject({
            code: McpGatewayErrorCode.CredentialMissing,
        })
    })

    it("fails loudly on a bearer sealed under another connection key: an error log and MCP_GATEWAY_CREDENTIAL_UNREADABLE", async () => {
        const { credentials, connectors, logger } = await build()
        connectors.storedCredential.mockResolvedValue({ state: "set", sealed: "sealed-with-another-key" })

        const refused = credentials.endpointOf("ws-1", { ...TARGET, credentialState: "set" })

        await expect(refused).rejects.toMatchObject({
            code: McpGatewayErrorCode.CredentialUnreadable,
            params: { key: "hakuen" },
        })
        expect(logger.error).toHaveBeenCalledWith(
            McpGatewayLogEvent.BearerUnreadable,
            expect.objectContaining({ code: McpGatewayErrorCode.CredentialUnreadable }),
            { workspaceId: "ws-1", connector: "hakuen" },
        )
    })
})

describe("McpConnectorCredentialService.assertKeyOpensStored", () => {
    it("proves the connection key against a sealed bearer sample, and refuses to boot on a key that was overwritten", async () => {
        const { credentials, connectors, secrets } = await build()
        connectors.sealedSample.mockResolvedValueOnce(SEALED).mockResolvedValueOnce("sealed-with-another-key")
        const mismatch = new ConnectionSecretsError({ code: ConnectionSecretsErrorCode.KeyMismatch })
        secrets.assertOpens.mockImplementation((sealed) => {
            if (sealed !== null && sealed !== SEALED) throw mismatch
        })

        await expect(credentials.assertKeyOpensStored()).resolves.toBeUndefined()
        await expect(credentials.assertKeyOpensStored()).rejects.toBe(mismatch)
        expect(secrets.assertOpens.mock.calls).toEqual([[SEALED], ["sealed-with-another-key"]])
    })
})
