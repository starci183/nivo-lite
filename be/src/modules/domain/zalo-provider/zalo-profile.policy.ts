import type { OptionalChatCustomerProfile } from "@modules/domain/chat-records"
import { isRecord } from "@modules/platform/primitives"

const DAY_MS = 86_400_000

/** A customer's profile is read again once it is this old: a customer changes their name or picture rarely. */
export const PROFILE_MAX_AGE_MS: number = 7 * DAY_MS

/** A customer whose read failed waits this long for the next try, so a refusing Zalo is not asked again every round. */
export const PROFILE_RETRY_MS: number = 3_600_000

/** The most customers one connection is read for in one round, so a run is bounded however many conversations are owed. */
export const PROFILE_BATCH: number = 10

/** The moments a round cuts on: a profile read before `refreshedBefore` is stale, a try after `triedBefore` waits. */
export interface ProfileCuts {
    /** A profile read before this moment is stale. */
    readonly refreshedBefore: Date
    /** A conversation tried after this moment waits for the next round. */
    readonly triedBefore: Date
}

/** The cuts of a round that starts at `now`. */
export const profileCuts = (now: Date): ProfileCuts => ({
    refreshedBefore: new Date(now.getTime() - PROFILE_MAX_AGE_MS),
    triedBefore: new Date(now.getTime() - PROFILE_RETRY_MS),
})

/** The profile a `chat.profile` answer holds; null when the answer is not the name and picture it announces. */
export const profileOfAnswer = (output: unknown): OptionalChatCustomerProfile => {
    if (!isRecord(output)) return null
    const { name, avatarUrl } = output
    return typeof name === "string" && typeof avatarUrl === "string" ? { name, avatarUrl } : null
}
