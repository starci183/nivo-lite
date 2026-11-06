import type { ConversationFacts } from "./chat-conversation.policy"
import type { LineFacts } from "./chat-lines.policy"
import type { ChatFollower } from "./chat-records.contracts"

/** The customers behind newest-first customer lines, one per conversation, the conversation's customer id and name with the time of their newest line; a conversation with no customer id on the channel is left out. */
export const followersOf = (
    conversations: ReadonlyArray<ConversationFacts>,
    newestFirst: ReadonlyArray<LineFacts>,
): ReadonlyArray<ChatFollower> => {
    const byId = new Map(conversations.map((facts) => [facts.id, facts]))
    const seen = new Set<string>()
    return newestFirst.flatMap((line): ReadonlyArray<ChatFollower> => {
        const facts = byId.get(line.data.conversationId)
        const externalId = facts?.data.externalId ?? null
        if (facts === undefined || externalId === null || seen.has(facts.id)) return []
        seen.add(facts.id)
        return [{ conversationId: facts.id, externalId, name: facts.data.name, lastAt: line.data.sentAt }]
    })
}
