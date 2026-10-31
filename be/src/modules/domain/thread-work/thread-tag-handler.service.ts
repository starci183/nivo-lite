import { Injectable } from "@nestjs/common"
import type { AgentTurnView } from "@modules/domain/agent-work"
import { ThreadAgentPostsService, ThreadFeedService } from "@modules/domain/thread-messages"
import type { ThreadMessage } from "@modules/domain/thread-messages"
import type { OptionalThreadTagTalk, ThreadTagLine, ThreadTagSpeaker } from "./thread-work.contracts"

/** How many messages before the tagging one a tagged agent reads. */
const BEFORE_SIZE = 12

/** The language of a thread answer when the wake carried none. */
const DEFAULT_LOCALE = "vi"

/** A thread message as one line of the talk. */
const lineOf = (message: ThreadMessage): ThreadTagLine => ({
    id: message.id,
    author: message.authorName,
    body: message.body,
})

@Injectable()
/**
 * The thread half of the tag handler: what a tagged agent reads in a work thread, the session its talk lives in, and the one place it
 * answers. The Office half drives the turn; this one knows only the thread. The agent writes through the thread's own door, so the
 * tag rules and the chain limits hold, and saying the same words twice for one wake says them once.
 */
export class ThreadTagHandlerService {
    constructor(
        private readonly feed: ThreadFeedService,
        private readonly posts: ThreadAgentPostsService,
    ) {}

    /** The messages said before the tagging one, and that one; undefined when the thread or the message is gone. */
    async talkOf(turn: AgentTurnView): Promise<OptionalThreadTagTalk> {
        const messages = await this.messagesOf(turn)
        const at = messages.findIndex((message) => message.id === turn.context.messageId)
        const tagged = messages[at]
        if (tagged === undefined) return undefined
        return { before: messages.slice(Math.max(0, at - BEFORE_SIZE), at).map(lineOf), tagged: lineOf(tagged) }
    }

    /** One session per thread. */
    sessionOf(turn: AgentTurnView): string {
        return `thread:${turn.context.threadId ?? ""}`
    }

    /** The agent writes in the thread, unless it already said these words since the wake. */
    async say(turn: AgentTurnView, speaker: ThreadTagSpeaker, text: string): Promise<void> {
        const { threadId } = turn.context
        if (threadId === undefined) return
        const said = (await this.messagesOf(turn)).some(
            (message) =>
                message.authorKind === "agent" &&
                message.authorId === speaker.id &&
                message.body === text &&
                new Date(message.createdAt).getTime() >= turn.wakeCreatedAt.getTime(),
        )
        if (said) return
        await this.posts.postAsAgent({
            workspaceId: turn.workspaceId,
            threadId,
            agentId: speaker.id,
            body: text,
            mentions: [],
            quoted: [],
            stepTitle: null,
            approval: null,
            locale: turn.context.locale ?? DEFAULT_LOCALE,
        })
    }

    /** The newest messages of the thread, oldest first, read as the member who tagged. */
    private async messagesOf(turn: AgentTurnView): Promise<ReadonlyArray<ThreadMessage>> {
        const { authorUserId, threadId } = turn.context
        if (authorUserId === undefined || threadId === undefined) return []
        return (await this.feed.read(authorUserId, turn.workspaceId, threadId)).messages
    }
}
