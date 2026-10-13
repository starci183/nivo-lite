import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { Secret } from "@modules/platform/config"
import { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } from "./connections.module-definition"
import { ConnectionsModule } from "./connections.module"
import type { ConnectionsOptions } from "./connections.options"
import { ConnectionsService } from "./connections.service"
import { ConnectionsErrorCode } from "./errors/connections.error"
import { CONNECTIONS_MESSAGES } from "./messages/connections.messages"
import * as connections from "./index"

describe("ConnectionsModule", () => {
    const options: ConnectionsOptions = {
        channelTokenKey: new Secret(Buffer.alloc(32, 1).toString("base64")),
        publicSiteUrl: undefined,
    }

    it.each([false, true])("registers its options and exports the service with isGlobal=%p", async (isGlobal) => {
        const service = mock<ConnectionsService>()
        const registration = ConnectionsModule.register({ ...options, isGlobal })
        const moduleRef = await Test.createTestingModule({ imports: [registration] })
            .overrideProvider(ConnectionsService)
            .useValue(service)
            .compile()

        expect(registration.global).toBe(isGlobal)
        expect(registration.exports).toEqual([ConnectionsService])
        expect(moduleRef.get(MODULE_OPTIONS_TOKEN)).toEqual(options)
        expect(moduleRef.get(ConnectionsService)).toBe(service)
        await moduleRef.close()
    })

    it("defaults to a local registration", () => {
        const registration = ConnectionsModule.register(options)

        expect(registration.global).toBe(false)
        expect(registration.providers).toContain(ConnectionsService)
        expect(registration.exports).toEqual([ConnectionsService])
    })

    it("supplies the service when the configurable base supplies no providers", () => {
        const register = jest
            .spyOn(ConfigurableModuleClass, "register")
            .mockReturnValueOnce({ module: ConnectionsModule })

        try {
            expect(ConnectionsModule.register(options)).toEqual({
                module: ConnectionsModule,
                providers: [ConnectionsService],
                exports: [ConnectionsService],
            })
            expect(register).toHaveBeenCalledWith(options)
        } finally {
            register.mockRestore()
        }
    })

    it("exports its public policies, configuration, module, service and error messages", () => {
        expect(Object.fromEntries(Object.entries(connections))).toEqual({
            decodeChannelKey: expect.any(Function),
            decryptSecret: expect.any(Function),
            encryptSecret: expect.any(Function),
            randomSecret: expect.any(Function),
            safeEqual: expect.any(Function),
            sha256: expect.any(Function),
            cleanConnectionName: expect.any(Function),
            isLocalOnly: expect.any(Function),
            publicSiteUrl: expect.any(Function),
            webhookUrlFor: expect.any(Function),
            connectorStatusOf: expect.any(Function),
            isPlannedConnector: expect.any(Function),
            parseConnectionsConfig: expect.any(Function),
            ConnectionsModule,
            ConnectionsService,
            CONNECTIONS_ERROR_KINDS: expect.any(Object),
            ConnectionsError: expect.any(Function),
            ConnectionsErrorCode,
            CONNECTIONS_MESSAGES,
        })
    })

    it("provides Vietnamese and English text for every connection error", () => {
        for (const code of Object.values(ConnectionsErrorCode)) {
            expect(CONNECTIONS_MESSAGES.vi?.[`errors.${code}`]).toEqual(expect.any(String))
            expect(CONNECTIONS_MESSAGES.en?.[`errors.${code}`]).toEqual(expect.any(String))
        }
    })

    it.each(["./connections.contracts", "./connections.options", "./persistence/connections.rows"])(
        "keeps %s as a type-only module",
        (moduleName) => {
            expect(jest.requireActual<object>(moduleName)).toEqual({})
        },
    )
})
