import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { ok, refused } from "@modules/platform/primitives"
import type { PrincipalVerifier } from "@modules/integrations/passport"
import { createAccessTokenVerifier, refuseSessions } from "./access-token.policy"
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
    it("hands the principal the package verified to the guard, checked at the instant of the clock", async () => {
        const subject = await build()
        const verifier = mock<PrincipalVerifier>()
        const principal = { id: "u1", email: "an@example.test", role: "authenticated", sessionId: "s1" } as const
        verifier.verify.mockResolvedValue(ok(principal))
        const clock = new FakeClock("2026-11-09T10:00:00.000Z")

        await expect(subject.createAccessTokenVerifier(verifier, clock)("jwt")).resolves.toEqual({
            kind: "ok",
            value: principal,
        })
        expect(verifier.verify).toHaveBeenCalledWith("jwt", new Date("2026-11-09T10:00:00.000Z"))
    })

    it("refuses what the package refuses, under the identity code", async () => {
        const subject = await build()
        const verifier = mock<PrincipalVerifier>()
        verifier.verify.mockResolvedValue(refused("PASSPORT_ACCESS_TOKEN_INVALID"))

        await expect(subject.createAccessTokenVerifier(verifier, new FakeClock())("jwt")).resolves.toMatchObject({
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
