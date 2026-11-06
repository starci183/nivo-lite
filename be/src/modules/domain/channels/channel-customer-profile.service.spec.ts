import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { ChatConversationTarget } from "@modules/domain/chat-records"
import { ZALO } from "@modules/integrations/zalo"
import type { ZaloClient } from "@modules/integrations/zalo"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ChannelCustomerProfileService } from "./channel-customer-profile.service"
import { ZaloCredentialsService } from "./zalo-credentials.service"

const target = (extra: Partial<ChatConversationTarget> = {}): ChatConversationTarget => ({
    id: "conv-1",
    workspaceId: "ws-1",
    channel: "zalo",
    externalId: "user-1",
    connectionId: "conn-1",
    ...extra,
})

const build = async () => {
    const credentials = mock<ZaloCredentialsService>()
    credentials.accessToken.mockResolvedValue("access-1")
    const zalo = mock<ZaloClient>()
    zalo.userProfile.mockResolvedValue({ name: "Minh", avatarUrl: "https://zalo.test/a.png" })
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ChannelCustomerProfileService,
            { provide: ZaloCredentialsService, useValue: credentials },
            { provide: ZALO, useValue: zalo },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { service: moduleRef.get(ChannelCustomerProfileService), credentials, zalo, logger }
}

describe("ChannelCustomerProfileService", () => {
    it("answers the name and the picture Zalo gives, asked for the customer id before an archive suffix", async () => {
        const { service, zalo } = await build()

        await expect(service.profileOf(target({ externalId: "user-1:1700000000" }))).resolves.toEqual({
            name: "Minh",
            avatarUrl: "https://zalo.test/a.png",
        })
        expect(zalo.userProfile).toHaveBeenCalledWith("access-1", "user-1")
    })

    it("answers null for another channel and for a conversation not tied to a customer or a connection, asking nobody", async () => {
        const { service, zalo, credentials } = await build()

        await expect(service.profileOf(target({ channel: "telegram" }))).resolves.toBeNull()
        await expect(service.profileOf(target({ externalId: null }))).resolves.toBeNull()
        await expect(service.profileOf(target({ connectionId: null }))).resolves.toBeNull()

        expect(credentials.accessToken).not.toHaveBeenCalled()
        expect(zalo.userProfile).not.toHaveBeenCalled()
    })

    it("answers null and logs it when the token or Zalo fails, instead of throwing", async () => {
        const { service, zalo, credentials, logger } = await build()
        zalo.userProfile.mockRejectedValueOnce(new Error("down"))
        credentials.accessToken.mockRejectedValueOnce(new Error("no tokens"))

        await expect(service.profileOf(target())).resolves.toBeNull()
        await expect(service.profileOf(target())).resolves.toBeNull()

        expect(logger.error).toHaveBeenCalledTimes(2)
    })
})
