import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { ok, refused } from "@modules/platform/primitives"
import { createAccessTokenVerifier, refuseSessions } from "./access-token.policy"
import type { AccessTokenSource } from "./access-token.policy"
import { IdentityErrorCode } from "./errors/identity.error"

const SUBJECT = Symbol("access-token.policy")
type Subject = { createAccessTokenVerifier: typeof createAccessTokenVerifier; refuseSessions: typeof refuseSessions }

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { createAccessTokenVerifier, refuseSessions } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("createAccessTokenVerifier", () => {
    it("turns verified claims into the same principal shape the resolvers already read", async () => {
        const subject = await build()
        const tokens = mock<AccessTokenSource>()
        tokens.verify.mockResolvedValue(ok({ sub: "u1", email: "an@example.test", sessionId: "s1" }))
        const clock = new FakeClock("2026-11-09T10:00:00.000Z")

        await expect(subject.createAccessTokenVerifier(tokens, clock)("jwt")).resolves.toEqual({
            kind: "ok",
            value: { id: "u1", email: "an@example.test", role: "authenticated", sessionId: "s1" },
        })
        expect(tokens.verify).toHaveBeenCalledWith("jwt", new Date("2026-11-09T10:00:00.000Z"))
    })

    it("omits the email when the token carries none", async () => {
        const subject = await build()
        const tokens = mock<AccessTokenSource>()
        tokens.verify.mockResolvedValue(ok({ sub: "u1", sessionId: "s1" }))

        const verified = await subject.createAccessTokenVerifier(tokens, new FakeClock())("jwt")

        expect(verified).toEqual({ kind: "ok", value: { id: "u1", role: "authenticated", sessionId: "s1" } })
    })

    it("refuses what the token client refuses", async () => {
        const subject = await build()
        const tokens = mock<AccessTokenSource>()
        tokens.verify.mockResolvedValue(refused("PASSPORT_ACCESS_TOKEN_INVALID"))

        await expect(subject.createAccessTokenVerifier(tokens, new FakeClock())("jwt")).resolves.toMatchObject({
            kind: "refused",
            code: IdentityErrorCode.AccessTokenInvalid,
        })
    })

    it("refuses every token when an app serves no session", async () => {
        const subject = await build()

        await expect(subject.refuseSessions("anything")).resolves.toMatchObject({
            kind: "refused",
            code: IdentityErrorCode.AccessTokenInvalid,
        })
    })
})
