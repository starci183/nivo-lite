import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ConfigurableModuleClass } from "./channel-connections.module-definition"
import { ChannelConnectionsModule } from "./channel-connections.module"
import { ChannelConnectionsService } from "./channel-connections.service"
import { ChannelConnectionsErrorCode } from "./errors/channel-connections.error"
import { CHANNEL_CONNECTIONS_MESSAGES } from "./messages/channel-connections.messages"

describe("ChannelConnectionsModule", () => {
    it.each([false, true])("registers and exports the service with isGlobal=%p", async (isGlobal) => {
        const service = mock<ChannelConnectionsService>()
        const base = ConfigurableModuleClass.register({ isGlobal })
        const registration = ChannelConnectionsModule.register({ isGlobal })
        expect(registration).toEqual({
            ...base,
            module: ChannelConnectionsModule,
            providers: [...(base.providers ?? []), ChannelConnectionsService],
            exports: [ChannelConnectionsService],
        })
        expect(registration.global).toBe(isGlobal)

        const moduleRef = await Test.createTestingModule({ imports: [registration] })
            .overrideProvider(ChannelConnectionsService)
            .useValue(service)
            .compile()

        expect(moduleRef.get(ChannelConnectionsService)).toBe(service)
        await moduleRef.close()
    })

    it("defaults to a local registration", async () => {
        const service = mock<ChannelConnectionsService>()
        const registration = ChannelConnectionsModule.register({})
        const moduleRef = await Test.createTestingModule({ imports: [registration] })
            .overrideProvider(ChannelConnectionsService)
            .useValue(service)
            .compile()

        expect(registration.global).toBe(false)
        expect(registration.exports).toEqual([ChannelConnectionsService])
        expect(moduleRef.get(ChannelConnectionsService)).toBe(service)
        await moduleRef.close()
    })

    it("supplies the service when the configurable base supplies no providers", async () => {
        const service = mock<ChannelConnectionsService>()
        const register = jest
            .spyOn(ConfigurableModuleClass, "register")
            .mockReturnValueOnce({ module: ChannelConnectionsModule })

        try {
            const registration = ChannelConnectionsModule.register({})
            expect(register).toHaveBeenCalledWith({})
            expect(registration).toEqual({
                module: ChannelConnectionsModule,
                providers: [ChannelConnectionsService],
                exports: [ChannelConnectionsService],
            })

            const moduleRef = await Test.createTestingModule({ imports: [registration] })
                .overrideProvider(ChannelConnectionsService)
                .useValue(service)
                .compile()

            expect(moduleRef.get(ChannelConnectionsService)).toBe(service)
            await moduleRef.close()
        } finally {
            register.mockRestore()
        }
    })

    it("gives every error code a message in both languages", () => {
        for (const code of Object.values(ChannelConnectionsErrorCode)) {
            expect(CHANNEL_CONNECTIONS_MESSAGES.vi?.[`errors.${code}`]).toEqual(expect.any(String))
            expect(CHANNEL_CONNECTIONS_MESSAGES.en?.[`errors.${code}`]).toEqual(expect.any(String))
        }
    })

    it.each(["./channel-connections.contracts", "./channel-connections.options"])(
        "keeps %s as a type-only module",
        (moduleName) => {
            expect(jest.requireActual<object>(moduleName)).toEqual({})
        },
    )
})
