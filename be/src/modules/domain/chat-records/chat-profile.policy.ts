import type { ListedRecord } from "@nivo-lite/agent-sdk/entity/port"
import { q, type Query } from "@nivo-lite/agent-sdk/query"
import { CONVERSATION_ENTITY } from "./chat-conversation.policy"
import type { ChatCustomerProfile, ChatProfileCandidate, ChatProfileDue } from "./chat-records.contracts"

/** The channel whose customers have a profile to read. */
const PROFILE_CHANNEL = "zalo"

/** The conversations of a connection that owe a profile, the newest customers first: never read or read before the cut, and not tried since the retry cut. */
export const profileDueQuery = (due: ChatProfileDue): Query => ({
    from: CONVERSATION_ENTITY,
    select: ["externalId"],
    where: q.and(
        q.eq("channel", PROFILE_CHANNEL),
        q.eq("connectionId", due.connectionId),
        q.notNull("externalId"),
        q.or(q.isNull("profileAt"), q.lt("profileAt", due.refreshedBefore.toISOString())),
        q.or(q.isNull("profileTriedAt"), q.lt("profileTriedAt", due.triedBefore.toISOString())),
    ),
    order: [
        ["lastAt", "desc"],
        ["id", "desc"],
    ],
    page: { size: due.limit },
})

/** The conversation a listed record is, with the customer id the channel knows; none for a record without one. */
export const candidateOf = (listed: Pick<ListedRecord, "row">): ReadonlyArray<ChatProfileCandidate> => {
    const externalId = listed.row.data["externalId"]
    return typeof externalId === "string" && externalId !== "" ? [{ id: listed.row.id, externalId }] : []
}

/** The first of each customer id: a customer is read once however many conversations name them. */
export const onePerCustomer = (candidates: ReadonlyArray<ChatProfileCandidate>): ReadonlyArray<ChatProfileCandidate> =>
    candidates.filter(
        (candidate, index) => candidates.findIndex((other) => other.externalId === candidate.externalId) === index,
    )

/** The values a read profile writes: the name only when the channel gave one, the picture or none, and the moment it was read. */
export const profileValues = (profile: ChatCustomerProfile, at: Date): Readonly<Record<string, string | null>> => ({
    ...(profile.name === "" ? {} : { name: profile.name }),
    avatarUrl: profile.avatarUrl === "" ? null : profile.avatarUrl,
    profileAt: at.toISOString(),
    profileTriedAt: at.toISOString(),
})

/** The values a failed read writes: only the moment of the try, so the name stays and the next round waits. */
export const triedValues = (at: Date): Readonly<Record<string, string>> => ({ profileTriedAt: at.toISOString() })
