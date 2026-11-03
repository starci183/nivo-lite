import type {
    AccountDirectory,
    AuthClock,
    AuthIds,
    AuthLogger,
    AuthOptions,
    RateCounter,
    SessionStore,
} from "@starci/auth/server"
import type { PassportOptions } from "./passport.options"

/** What the package needs beside the settings: the stores `domain/identity` implements and the app's clock and ids. */
export interface PassportStores {
    /** The session and refresh-token tables behind the app's ORM. */
    readonly sessions: SessionStore
    /** The user table, as far as sessions need it. */
    readonly accounts: AccountDirectory
    /** The counter the sign-in budget uses. */
    readonly rate: RateCounter
    /** The app's clock. */
    readonly clock: AuthClock
    /** The app's id source. */
    readonly ids: AuthIds
    /** Where the package reports a security event (a replayed refresh token, a failed Google sign-in). */
    readonly logger: AuthLogger
}

/** The complete options of @starci/auth: the typed settings joined with the app's stores, clock and ids. */
export const passportKit = (options: PassportOptions, stores: PassportStores): AuthOptions => ({
    ...options,
    sessions: stores.sessions,
    accounts: stores.accounts,
    rate: stores.rate,
    clock: stores.clock,
    ids: stores.ids,
    logger: stores.logger,
})
