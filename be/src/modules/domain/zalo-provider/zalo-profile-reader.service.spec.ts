import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ZALO, ZaloError, ZaloErrorCode, type ZaloClient } from "@modules/integrations/zalo"
import { ZALO_ACCESS_TOKENS, type ZaloAccessTokens } from "./zalo-access-tokens.port"
import { ZaloProfileReaderService } from "./zalo-profile-reader.service"

const build = async () => {
    const zalo = mock<ZaloClient>()
    zalo.userProfile.mockResolvedValue({ name: "Lan", avatarUrl: "https://zalo.test/a.jpg" })
    const tokens = mock<ZaloAccessTokens>()
    tokens.tokenOf.mockResolvedValue({ kind: "token", token: "tok" })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ZaloProfileReaderService,
            { provide: ZALO, useValue: zalo },
            { provide: ZALO_ACCESS_TOKENS, useValue: tokens },
        ],
    }).compile()
    return { reader: moduleRef.get(ZaloProfileReaderService), zalo, tokens }
}

describe("ZaloProfileReaderService", () => {
    it("is the Zalo OA's profile read: what Zalo says of the customer, with the connection's token", async () => {
        const { reader, zalo, tokens } = await build()

        expect(reader.provider).toBe("zalo_oa")
        await expect(reader.profileOf("c-1", "user-1")).resolves.toEqual({
            name: "Lan",
            picture: "https://zalo.test/a.jpg",
        })
        expect(tokens.tokenOf).toHaveBeenCalledWith("c-1")
        expect(zalo.userProfile).toHaveBeenCalledWith("tok", "user-1")
    })

    it("answers null when the connection has no token yet, or Zalo refuses, without asking or throwing", async () => {
        const { reader, zalo, tokens } = await build()
        tokens.tokenOf.mockResolvedValueOnce({ kind: "skipped", reason: "no_token" })
        await expect(reader.profileOf("c-1", "user-1")).resolves.toBeNull()
        expect(zalo.userProfile).not.toHaveBeenCalled()

        zalo.userProfile.mockRejectedValueOnce(new ZaloError({ code: ZaloErrorCode.NotPermitted }))
        await expect(reader.profileOf("c-1", "user-1")).resolves.toBeNull()
    })
})
