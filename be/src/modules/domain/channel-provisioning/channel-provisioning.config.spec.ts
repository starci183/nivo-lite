import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { EnvSource, Secret } from "@modules/platform/config"
import { parseChannelProvisioningConfig } from "./channel-provisioning.config"
import { CHANNEL_PROVISIONING_OPTIONS } from "./channel-provisioning.decorators"
import type { ChannelProvisioningOptions } from "./channel-provisioning.options"

describe("parseChannelProvisioningConfig", () => {
    it("leaves the Telegram and Zalo credentials absent when their variables are missing", async () => {
        const env = mock<EnvSource>()
        const print = jest.fn()
        env.has.mockReturnValue(false)
        env.optional.mockReturnValue(undefined)

        const moduleRef = await Test.createTestingModule({
            providers: [
                { provide: EnvSource, useValue: env },
                {
                    provide: CHANNEL_PROVISIONING_OPTIONS,
                    useFactory: (source: EnvSource) => parseChannelProvisioningConfig(source, print),
                    inject: [EnvSource],
                },
            ],
        }).compile()

        expect(moduleRef.get<ChannelProvisioningOptions>(CHANNEL_PROVISIONING_OPTIONS)).toEqual({
            telegramToken: undefined,
            zaloAppId: undefined,
            zaloAppSecret: undefined,
            print,
        })
        expect(env.has).toHaveBeenCalledTimes(2)
        expect(env.has).toHaveBeenNthCalledWith(1, "CHANNEL_BOT_TOKEN")
        expect(env.has).toHaveBeenNthCalledWith(2, "ZALO_APP_SECRET")
        expect(env.optional).toHaveBeenCalledTimes(1)
        expect(env.optional).toHaveBeenCalledWith("ZALO_APP_ID")
        expect(env.secret).not.toHaveBeenCalled()
        expect(print).not.toHaveBeenCalled()
        await moduleRef.close()
    })

    it("reads the configured Telegram token and Zalo credentials without printing them", async () => {
        const env = mock<EnvSource>()
        const print = jest.fn()
        const telegramToken = new Secret("telegram-bot-token")
        const zaloAppSecret = new Secret("zalo-app-secret")
        env.has.mockReturnValue(true)
        env.optional.mockReturnValue("zalo-app-id")
        env.secret.mockReturnValueOnce(telegramToken).mockReturnValueOnce(zaloAppSecret)

        const moduleRef = await Test.createTestingModule({
            providers: [
                { provide: EnvSource, useValue: env },
                {
                    provide: CHANNEL_PROVISIONING_OPTIONS,
                    useFactory: (source: EnvSource) => parseChannelProvisioningConfig(source, print),
                    inject: [EnvSource],
                },
            ],
        }).compile()

        expect(moduleRef.get<ChannelProvisioningOptions>(CHANNEL_PROVISIONING_OPTIONS)).toEqual({
            telegramToken,
            zaloAppId: "zalo-app-id",
            zaloAppSecret,
            print,
        })
        expect(env.has).toHaveBeenCalledTimes(2)
        expect(env.has).toHaveBeenNthCalledWith(1, "CHANNEL_BOT_TOKEN")
        expect(env.has).toHaveBeenNthCalledWith(2, "ZALO_APP_SECRET")
        expect(env.optional).toHaveBeenCalledTimes(1)
        expect(env.optional).toHaveBeenCalledWith("ZALO_APP_ID")
        expect(env.secret).toHaveBeenCalledTimes(2)
        expect(env.secret).toHaveBeenNthCalledWith(1, "CHANNEL_BOT_TOKEN")
        expect(env.secret).toHaveBeenNthCalledWith(2, "ZALO_APP_SECRET")
        expect(print).not.toHaveBeenCalled()
        await moduleRef.close()
    })
})
