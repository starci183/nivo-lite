import { timingSafeEqual } from "node:crypto"
import { Injectable } from "@nestjs/common"
import type { Request } from "express"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectIds } from "@modules/platform/ids"
import type { Ids } from "@modules/platform/ids"
import { sameSitePath } from "@modules/platform/primitives"
import { cookieValue } from "./cookie-read.policy"
import { InjectPassportOptions, InjectPassportTokens } from "./passport.decorators"
import type { PassportOptions } from "./passport.options"
import type { PassportTokensClient } from "./passport-tokens.client"

/** The cookie that carries one Google round trip. */
export const GOOGLE_STATE_COOKIE = "nivo_google_state"
/** The only path the state cookie is sent to. */
export const GOOGLE_STATE_PATH = "/auth/google"
const STATE_TTL_MS = 600_000

type StoreDone = (error: Error | null, handle?: string) => void
type VerifyDone = (error: Error | null, verifier?: unknown, context?: unknown) => void

const sameValue = (given: string, expected: string): boolean => {
    const left = Buffer.from(given)
    const right = Buffer.from(expected)
    return left.length === right.length && timingSafeEqual(left, right)
}

@Injectable()
/**
 * The state store passport-oauth2 calls for `state` and PKCE without a server session: the handle (echoed as `state`), the code verifier and
 * the landing path travel in a signed, httpOnly cookie that only the callback path receives, and the handle is compared on return. The
 * landing path is a same-site path only, so the callback can never redirect off the web origin.
 */
export class GoogleStateClient {
    constructor(
        @InjectPassportTokens() private readonly tokens: PassportTokensClient,
        @InjectClock() private readonly clock: Clock,
        @InjectIds() private readonly ids: Ids,
        @InjectPassportOptions() private readonly options: PassportOptions,
    ) {}

    /** Called by passport-oauth2 on the outbound leg (the five-argument PKCE form). */
    store(req: Request, verifier: string, _state: unknown, _meta: unknown, done: StoreDone): void {
        const handle = this.ids.next()
        const next = this.landingOf(req)
        const signed = this.tokens.signState({
            w: handle,
            u: verifier,
            r: next,
            e: this.clock.now().getTime() + STATE_TTL_MS,
            p: "google",
        })
        req.res?.cookie(GOOGLE_STATE_COOKIE, signed, {
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            path: GOOGLE_STATE_PATH,
            maxAge: STATE_TTL_MS,
        })
        done(null, handle)
    }

    /** The same-site path to land on: the requested return address when it is a path, or an absolute address on the web origin; else the root. */
    private landingOf(req: Request): string {
        const { returnTo, next }: { returnTo?: unknown; next?: unknown } = req.query
        const wanted = typeof returnTo === "string" ? returnTo : next
        if (typeof wanted !== "string") return "/"
        if (!URL.canParse(wanted)) return sameSitePath(wanted, "/")
        const url = new URL(wanted)
        return url.origin === this.options.returnOrigin ? sameSitePath(`${url.pathname}${url.search}`, "/") : "/"
    }

    /** Called by passport-oauth2 on the return leg (it passes the meta form, since this method takes four arguments): the cookie must be ours, unexpired and carry the same handle as `state`. */
    verify(req: Request, providedState: string, _meta: unknown, done: VerifyDone): void {
        const raw = cookieValue(req.headers.cookie ?? "", GOOGLE_STATE_COOKIE)
        req.res?.clearCookie(GOOGLE_STATE_COOKIE, {
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            path: GOOGLE_STATE_PATH,
        })
        const state = raw === "" ? null : this.tokens.verifyState(raw, this.clock.now())
        if (state?.p !== "google" || typeof providedState !== "string" || !sameValue(state.w, providedState)) {
            done(null, false, { message: "state" })
            return
        }
        done(null, state.u, { next: sameSitePath(state.r, "/") })
    }
}
