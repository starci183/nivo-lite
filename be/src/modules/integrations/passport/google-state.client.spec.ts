import { Test } from "@nestjs/testing"
import { FakeClock, fakeIds, mock } from "@starci/jest-preset"
import type { Request, Response } from "express"
import { CLOCK } from "@modules/platform/clock"
import { IDS } from "@modules/platform/ids"
import { GOOGLE_STATE_COOKIE, GoogleStateClient } from "./google-state.client"
import { PASSPORT_OPTIONS, PASSPORT_TOKENS } from "./passport.decorators"
import type { PassportTokensClient } from "./passport-tokens.client"

const NOW = new Date("2026-11-09T10:00:00.000Z")
const SIGNED = "signed-state-cookie"
const HANDLE = "00000000-0000-4000-8000-000000000001"

const build = async (verified: ReturnType<PassportTokensClient["verifyState"]> = null) => {
    const tokens = mock<PassportTokensClient>()
    tokens.signState.mockReturnValue(SIGNED)
    tokens.verifyState.mockReturnValue(verified)
    const moduleRef = await Test.createTestingModule({
        providers: [
            GoogleStateClient,
            { provide: PASSPORT_TOKENS, useValue: tokens },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: IDS, useValue: fakeIds() },
            { provide: PASSPORT_OPTIONS, useValue: { returnOrigin: "https://app.example.test" } },
        ],
    }).compile()
    return { target: moduleRef.get(GoogleStateClient), tokens }
}

const outbound = (next?: string, key = "next") => {
    const res = mock<Response>()
    const req = mock<Request>({ query: next === undefined ? {} : { [key]: next }, res, headers: {} })
    return { req, res }
}

const returning = (cookie: string | undefined) => {
    const res = mock<Response>()
    const headers = cookie === undefined ? {} : { cookie: `${GOOGLE_STATE_COOKIE}=${cookie}` }
    return { req: mock<Request>({ headers, res }), res }
}

const begin = (target: GoogleStateClient, req: Request, verifier: string) =>
    new Promise<string | undefined>((resolve, reject) => {
        target.store(req, verifier, undefined, undefined, (error, handle) => {
            if (error === null) resolve(handle)
            else reject(error)
        })
    })

const finish = (target: GoogleStateClient, req: Request, state: string) =>
    new Promise<{ verifier: unknown; context: unknown }>((resolve, reject) => {
        target.verify(req, state, undefined, (error, verifier, context) => {
            if (error === null) resolve({ verifier, context })
            else reject(error)
        })
    })

describe("GoogleStateClient / store", () => {
    it("signs the handle, verifier, landing path and expiry into an httpOnly, secure, lax cookie scoped to the Google path", async () => {
        const { target, tokens } = await build()
        const { req, res } = outbound("/inbox")

        await expect(begin(target, req, "pkce-verifier")).resolves.toBe(HANDLE)

        expect(tokens.signState).toHaveBeenCalledWith({
            w: HANDLE,
            u: "pkce-verifier",
            r: "/inbox",
            e: NOW.getTime() + 600_000,
            p: "google",
        })
        expect(res.cookie).toHaveBeenCalledWith(
            GOOGLE_STATE_COOKIE,
            SIGNED,
            expect.objectContaining({
                httpOnly: true,
                secure: true,
                sameSite: "lax",
                path: "/auth/google",
                maxAge: 600_000,
            }),
        )
    })

    it("accepts an absolute return address on the web origin and keeps only its path", async () => {
        const { target, tokens } = await build()

        await begin(target, outbound("https://app.example.test/inbox?tab=1", "returnTo").req, "v")

        expect(tokens.signState).toHaveBeenCalledWith(expect.objectContaining({ r: "/inbox?tab=1" }))
    })

    it("lands on the root when the requested path leaves the site (no open redirect)", async () => {
        const { target, tokens } = await build()

        await begin(target, outbound("https://evil.example/steal").req, "v")
        await begin(target, outbound("//evil.example").req, "v")

        expect(tokens.signState).toHaveBeenNthCalledWith(1, expect.objectContaining({ r: "/" }))
        expect(tokens.signState).toHaveBeenNthCalledWith(2, expect.objectContaining({ r: "/" }))
    })
})

describe("GoogleStateClient / verify", () => {
    const state = { w: HANDLE, u: "pkce-verifier", r: "/inbox", e: NOW.getTime() + 1000, p: "google" }

    it("hands back the verifier and landing path when the state matches the cookie, and clears the cookie", async () => {
        const { target, tokens } = await build(state)
        const { req, res } = returning(SIGNED)

        await expect(finish(target, req, HANDLE)).resolves.toEqual({
            verifier: "pkce-verifier",
            context: { next: "/inbox" },
        })
        expect(tokens.verifyState).toHaveBeenCalledWith(SIGNED, NOW)
        expect(res.clearCookie).toHaveBeenCalledWith(
            GOOGLE_STATE_COOKIE,
            expect.objectContaining({ path: "/auth/google" }),
        )
    })

    it("refuses a state that is not the one in the cookie", async () => {
        const { target } = await build(state)

        await expect(finish(target, returning(SIGNED).req, "forged-state")).resolves.toMatchObject({ verifier: false })
    })

    it("refuses a callback with no cookie", async () => {
        const { target, tokens } = await build(state)

        await expect(finish(target, returning(undefined).req, HANDLE)).resolves.toMatchObject({ verifier: false })
        expect(tokens.verifyState).not.toHaveBeenCalled()
    })

    it("refuses a cookie that is not ours, expired, or made for another purpose", async () => {
        const unsigned = await build(null)
        await expect(finish(unsigned.target, returning("forged").req, HANDLE)).resolves.toMatchObject({
            verifier: false,
        })

        const other = await build({ ...state, p: "invite" })
        await expect(finish(other.target, returning(SIGNED).req, HANDLE)).resolves.toMatchObject({ verifier: false })
    })

    it("lands on the root when the signed path is not a same-site path", async () => {
        const { target } = await build({ ...state, r: "https://evil.example" })

        await expect(finish(target, returning(SIGNED).req, HANDLE)).resolves.toMatchObject({ context: { next: "/" } })
    })
})
