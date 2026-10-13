import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { Secret } from "@modules/platform/config"
import { parseChannelProvisioningConfig } from "./channel-provisioning.config"
import { CHANNEL_PROVISIONING_OPTIONS } from "./channel-provisioning.decorators"
import { ConfigurableModuleClass } from "./channel-provisioning.module-definition"
import { ChannelProvisioningModule } from "./channel-provisioning.module"
import { ChannelProvisioningService } from "./channel-provisioning.service"
import type { ChannelProvisioningOptions } from "./channel-provisioning.options"
import * as channelProvisioning from "./index"

describe("ChannelProvisioningModule", () => {
    const options: ChannelProvisioningOptions = {
        telegramToken: new Secret("telegram-token"),
        zaloAppId: "zalo-app-id",
        zaloAppSecret: new Secret("zalo-secret"),
        print: jest.fn(),
    }

    it.each([false, true])("registers its options and exports the service with isGlobal=%p", async (isGlobal) => {
        const service = mock<ChannelProvisioningService>()
        const base = ConfigurableModuleClass.register({ ...options, isGlobal })
        const registration = ChannelProvisioningModule.register({ ...options, isGlobal })
        expect(registration).toEqual({
            ...base,
            module: ChannelProvisioningModule,
            providers: [...(base.providers ?? []), ChannelProvisioningService],
            exports: [ChannelProvisioningService],
        })
        expect(registration.global).toBe(isGlobal)

        const moduleRef = await Test.createTestingModule({ imports: [registration] })
            .overrideProvider(ChannelProvisioningService)
            .useValue(service)
            .compile()

        expect(moduleRef.get(CHANNEL_PROVISIONING_OPTIONS)).toEqual(options)
        expect(moduleRef.get(ChannelProvisioningService)).toBe(service)
        await moduleRef.close()
    })

    it("defaults to a local registration", async () => {
        const service = mock<ChannelProvisioningService>()
        const registration = ChannelProvisioningModule.register(options)
        const moduleRef = await Test.createTestingModule({ imports: [registration] })
            .overrideProvider(ChannelProvisioningService)
            .useValue(service)
            .compile()

        expect(registration.global).toBe(false)
        expect(registration.exports).toEqual([ChannelProvisioningService])
        expect(moduleRef.get(CHANNEL_PROVISIONING_OPTIONS)).toEqual(options)
        expect(moduleRef.get(ChannelProvisioningService)).toBe(service)
        await moduleRef.close()
    })

    it("supplies the service when the configurable base supplies no providers", async () => {
        const service = mock<ChannelProvisioningService>()
        const register = jest
            .spyOn(ConfigurableModuleClass, "register")
            .mockReturnValueOnce({ module: ChannelProvisioningModule })

        try {
            const registration = ChannelProvisioningModule.register(options)
            expect(register).toHaveBeenCalledWith(options)
            expect(registration).toEqual({
                module: ChannelProvisioningModule,
                providers: [ChannelProvisioningService],
                exports: [ChannelProvisioningService],
            })

            const moduleRef = await Test.createTestingModule({ imports: [registration] })
                .overrideProvider(ChannelProvisioningService)
                .useValue(service)
                .compile()

            expect(moduleRef.get(ChannelProvisioningService)).toBe(service)
            await moduleRef.close()
        } finally {
            register.mockRestore()
        }
    })

    it("exports its public configuration, module and service", () => {
        expect(channelProvisioning).toEqual({
            parseChannelProvisioningConfig,
            ChannelProvisioningModule,
            ChannelProvisioningService,
        })
    })

    it.each([
        "./channel-provisioning.contracts",
        "./channel-provisioning.options",
        "./persistence/channel-provisioning.rows",
    ])("keeps %s as a type-only module", (moduleName) => {
        expect(jest.requireActual<object>(moduleName)).toEqual({})
    })
})
