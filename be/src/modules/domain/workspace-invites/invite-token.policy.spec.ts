import { Test } from "@nestjs/testing"
import { hashInviteToken as realHashInviteToken } from "./invite-token.policy"

const SUBJECT = Symbol("invite-token.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { hashInviteToken: realHashInviteToken } }],
    }).compile()
    return moduleRef.get<{ hashInviteToken: typeof realHashInviteToken }>(SUBJECT)
}

describe("invite-token.policy", () => {
    it("hashes the token to its hex SHA-256", async () => {
        const { hashInviteToken } = await buildSubject()

        expect(hashInviteToken("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
    })

    it("hashes the empty token to the SHA-256 of nothing", async () => {
        const { hashInviteToken } = await buildSubject()

        expect(hashInviteToken("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
    })

    it("hashes the token as UTF-8", async () => {
        const { hashInviteToken } = await buildSubject()

        expect(hashInviteToken("\u00e9")).toBe("4a99557e4033c3539de2eb65472017cad5f9557f7a0625a09f1c3f6e2ba69c4c")
    })

    it("gives the same hash twice and a different one for another token", async () => {
        const { hashInviteToken } = await buildSubject()

        expect(hashInviteToken("t-1")).toBe(hashInviteToken("t-1"))
        expect(hashInviteToken("t-1")).not.toBe(hashInviteToken("t-2"))
    })
})
