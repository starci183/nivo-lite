import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { EnvSource, Secret } from "@modules/platform/config"
import { parseChannelProvisioningConfig } from "./channel-provisioning.config"
import { CHANNEL_PROVISIONING_OPTIONS } from "./channel-provisioning.decorators"
import type { ChannelProvisioningOptions } from "./channel-provisioning.options"

describe("parseChannelProvisioningConfig", () => {
    it("leaves the Telegram token absent when its variable is missing", async () => {
        const env = mock<EnvSource>()
        const print = jest.fn()
        env.has.mockReturnValue(false)

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
            print,
        })
        expect(env.has.mock.calls).toEqual([["CHANNEL_BOT_TOKEN"]])
        expect(env.optional).not.toHaveBeenCalled()
        expect(env.secret).not.toHaveBeenCalled()
        expect(print).not.toHaveBeenCalled()
        await moduleRef.close()
    })

    it("reads only the configured Telegram token without printing it", async () => {
        const env = mock<EnvSource>()
        const print = jest.fn()
        const telegramToken = new Secret("telegram-bot-token")
        env.has.mockReturnValue(true)
        env.secret.mockReturnValue(telegramToken)

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
            print,
        })
        expect(env.has.mock.calls).toEqual([["CHANNEL_BOT_TOKEN"]])
        expect(env.optional).not.toHaveBeenCalled()
        expect(env.secret.mock.calls).toEqual([["CHANNEL_BOT_TOKEN"]])
        expect(print).not.toHaveBeenCalled()
        await moduleRef.close()
    })
})
