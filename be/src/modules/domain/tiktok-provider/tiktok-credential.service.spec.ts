import { Test } from "@nestjs/testing"
import { TIKTOK_ACCESS_TOKEN, TIKTOK_EXPIRES_AT, TIKTOK_REFRESH_TOKEN, tiktokTokensOf } from "./tiktok-credential.service"

const SUBJECT = Symbol("tiktok-credential.service")

const tokensReaderOf = async (): Promise<typeof tiktokTokensOf> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: tiktokTokensOf }],
    }).compile()
    return moduleRef.get<typeof tiktokTokensOf>(SUBJECT)
}

describe("tiktokTokensOf (a sealed secret's plain text)", () => {
    it("reads the trimmed tokens and the expiry a secret holds", async () => {
        const read = await tokensReaderOf()
        const plain = JSON.stringify({ [TIKTOK_ACCESS_TOKEN]: " act.1 ", [TIKTOK_REFRESH_TOKEN]: "rft.1", [TIKTOK_EXPIRES_AT]: 1000 })

        expect(read(plain)).toEqual({ accessToken: "act.1", refreshToken: "rft.1", expiresAt: 1000 })
    })

    it.each(["not json", "[]", "7", "{}"])("reads nothing from %s", async (plain) => {
        const read = await tokensReaderOf()

        expect(read(plain)).toEqual({})
    })
})
