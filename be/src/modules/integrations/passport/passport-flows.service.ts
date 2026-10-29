import { Injectable } from "@nestjs/common"
import passport from "passport"
import { isRecord, sameSitePath } from "@modules/platform/primitives"
import { PassportError, PassportErrorCode } from "./errors/passport.error"
import type { AuthSubject, GoogleCompletion, HttpExchange } from "./passport.contracts"
import { InjectPassportOptions } from "./passport.decorators"
import type { PassportOptions } from "./passport.options"

const isSubject = (value: unknown): value is AuthSubject =>
    isRecord(value) && typeof value.userId === "string" && typeof value.email === "string"

type Settled = (error: unknown, user?: unknown, info?: unknown) => void
type StrategyHandler = (req: HttpExchange["req"], res: HttpExchange["res"], next: (error?: unknown) => void) => void

const isHandler = (value: unknown): value is StrategyHandler => typeof value === "function"

/** The middleware passport built; passport types it as any, so it is checked once here. */
const handlerOf = (built: unknown): StrategyHandler => {
    if (!isHandler(built)) throw new PassportError({ code: PassportErrorCode.GoogleUnavailable })
    return built
}

@Injectable()
/** Runs the passport strategies for one request without sessions; the only caller of `passport.authenticate`. */
export class PassportFlowsService {
    constructor(@InjectPassportOptions() private readonly options: PassportOptions) {}

    /** Runs the local strategy over the posted body; answers the person, or throws the domain refusal. */
    authenticateLocal(exchange: HttpExchange): Promise<AuthSubject> {
        return new Promise<AuthSubject>((resolve, reject) => {
            const settled: Settled = (error, user) => {
                if (error !== null && error !== undefined)
                    reject(error instanceof Error ? error : new Error("passport"))
                else if (isSubject(user)) resolve(user)
                else reject(new PassportError({ code: PassportErrorCode.MissingCredentials }))
            }
            handlerOf(passport.authenticate("local", { session: false }, settled))(exchange.req, exchange.res, reject)
        })
    }

    /** Sends the browser to the Google consent screen (the response is the redirect); the optional `next` query value is kept in the state cookie. */
    beginGoogle(exchange: HttpExchange): Promise<void> {
        if (this.options.google === null)
            return Promise.reject(new PassportError({ code: PassportErrorCode.GoogleUnavailable }))
        return new Promise<void>((resolve, reject) => {
            exchange.res.once("finish", resolve)
            const built: unknown = passport.authenticate(
                "google",
                { session: false, prompt: "select_account" },
                (error: unknown) => {
                    reject(error instanceof Error ? error : new Error("passport"))
                },
            )
            handlerOf(built)(exchange.req, exchange.res, reject)
        })
    }

    /** Finishes the Google round trip: the state cookie, the PKCE verifier and the profile must all check out. */
    completeGoogle(exchange: HttpExchange): Promise<GoogleCompletion> {
        if (this.options.google === null)
            return Promise.reject(new PassportError({ code: PassportErrorCode.GoogleUnavailable }))
        return new Promise<GoogleCompletion>((resolve, reject) => {
            const settled: Settled = (error, user, info) => {
                if (error !== null && error !== undefined) {
                    reject(error instanceof Error ? error : new Error("passport"))
                    return
                }
                if (!isSubject(user)) {
                    reject(new PassportError({ code: PassportErrorCode.GoogleStateInvalid }))
                    return
                }
                const state = isRecord(info) && isRecord(info.state) ? info.state.next : undefined
                resolve({ subject: user, next: sameSitePath(typeof state === "string" ? state : undefined, "/") })
            }
            handlerOf(passport.authenticate("google", { session: false }, settled))(exchange.req, exchange.res, reject)
        })
    }
}
