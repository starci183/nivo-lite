import type { GraphQLResponse } from "@/modules/types"

/** The access token lives in this module's memory only: never in storage, never in a cookie. The refresh token is an httpOnly cookie. */
let accessToken: string | undefined
let expiresAt = 0
let announced = false
let inFlight: Promise<GraphQLResponse<string>> | undefined

/** Keeps a granted access token and the instant it stops being valid. */
export const holdToken = (token: string, lifetimeSeconds: number): void => {
    accessToken = token
    expiresAt = Date.now() + lifetimeSeconds * 1000
    announced = true
}

/** Forgets the token and says whether there was one. */
export const dropToken = (): boolean => {
    const had = accessToken !== undefined
    accessToken = undefined
    expiresAt = 0
    announced = true
    return had
}

/** The held access token, or `undefined` when none is held. */
export const heldToken = (): string | undefined => accessToken

/** Whether the held token is still valid for at least `skewMs` more. */
export const isTokenFresh = (skewMs: number): boolean => accessToken !== undefined && expiresAt - skewMs > Date.now()

/** Whether the session has been announced once (a grant arrived or the first check came back empty). */
export const wasAnnounced = (): boolean => announced

/** Marks the session as announced. */
export const markAnnounced = (): void => {
    announced = true
}

/** Runs `start` unless a refresh is already in flight; overlapping callers share the one answer. */
export const shareRefresh = (start: () => Promise<GraphQLResponse<string>>): Promise<GraphQLResponse<string>> => {
    inFlight ??= start().finally(() => {
        inFlight = undefined
    })
    return inFlight
}
