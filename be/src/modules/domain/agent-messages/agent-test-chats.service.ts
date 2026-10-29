import { Injectable } from "@nestjs/common"
import { AgentConversationsReadService } from "@modules/domain/agent-conversations"
import type { ChatNewest, ChatReader } from "./agent-messages-read.contracts"
import { AgentMessagesReadService } from "./agent-messages-read.service"
import type { AgentChatMark, AgentChats } from "./agent-test-chats.contracts"

/** How many test chats the agents of one read may have in all. */
const TEST_CHAT_LIMIT = 1000
/** The most unread lines a badge counts. */
const BADGE_CAP = 99

/** The newest of two lines: later instant first, ties by line id. */
const newerOf = (left: ChatNewest | undefined, right: ChatNewest | undefined): ChatNewest | undefined => {
    if (left === undefined || right === undefined) return left ?? right
    if (left.sort_at !== right.sort_at) return left.sort_at > right.sort_at ? left : right
    return left.id > right.id ? left : right
}

@Injectable()
/** The test chats of the agents (people trying an agent out) seen as one direct conversation per agent. */
export class AgentTestChatsService {
    constructor(
        private readonly conversations: AgentConversationsReadService,
        private readonly lines: AgentMessagesReadService,
    ) {}

    /** For each given agent: the caller's unread lines across its test chats (capped) and the newest line of them. */
    async activityOf(
        workspaceId: string,
        reader: ChatReader,
        marks: ReadonlyArray<AgentChatMark>,
    ): Promise<Array<AgentChats>> {
        const chats = await this.conversations.testChatsOf(
            workspaceId,
            marks.map((mark) => mark.agentId),
            TEST_CHAT_LIMIT,
        )
        const readAtOf = new Map(marks.map((mark) => [mark.agentId, mark.readAt]))
        const activity = await this.lines.chatActivity(
            workspaceId,
            reader,
            chats.map((chat) => ({ conversationId: chat.id, readAt: readAtOf.get(chat.agentId) ?? null })),
        )
        const agentOf = new Map(chats.map((chat) => [chat.id, chat.agentId]))
        return marks.map(({ agentId }): AgentChats => {
            const own = activity.filter((entry) => agentOf.get(entry.conversationId) === agentId)
            const newest = own.map((entry) => entry.newest).reduce(newerOf, undefined)
            return {
                agentId,
                unread: Math.min(
                    BADGE_CAP,
                    own.reduce((sum, entry) => sum + entry.unread, 0),
                ),
                newest:
                    newest === undefined
                        ? undefined
                        : {
                              id: newest.id,
                              body: newest.body,
                              author_user_id: newest.author_user_id,
                              author_name: newest.author_name,
                              at: newest.at,
                          },
            }
        })
    }
}
