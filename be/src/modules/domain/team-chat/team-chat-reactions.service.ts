import { Injectable } from "@nestjs/common"
import { TeamChatErrorCode } from "./errors/team-chat.error"
import type { MessageView, TeamChatResult } from "./team-chat.contracts"
import type { OptionalCount } from "./team-chat-store.contracts"
import { chatDone, chatRefusal } from "./team-chat.policy"
import { canonicalEmojiOf, tapsAcceptedOf, timesOf } from "./team-chat-reaction.policy"
import { TeamChatReactionStoreService } from "./team-chat-reaction-store.service"
import { TeamChatStoreService } from "./team-chat-store.service"
import { TeamChatViewsService } from "./team-chat-views.service"

@Injectable()
/**
 * Reactions to the messages of a room, Zalo style: a member taps an emoji as many times as they like and the count grows by each tap.
 * Only a member who sits in the room reacts (an owner of the workspace who does not sit in it only reads). A person's message, an
 * agent's message and a card are all reacted to the same way.
 */
export class TeamChatReactionsService {
    constructor(
        private readonly store: TeamChatStoreService,
        private readonly reactions: TeamChatReactionStoreService,
        private readonly views: TeamChatViewsService,
    ) {}

    /**
     * Adds `times` taps of `emoji` to a message as the viewer and answers the message with its reactions as the viewer sees them. A
     * call that follows the last tap of the same emoji too fast is refused; one that asks for more than a human can tap in the time
     * between two calls is counted for what fits.
     */
    async react(
        workspaceId: string,
        viewerId: string,
        messageId: string,
        emoji: string,
        times: OptionalCount,
    ): Promise<TeamChatResult<MessageView>> {
        const canonical = canonicalEmojiOf(emoji)
        if (canonical === null) return chatRefusal(TeamChatErrorCode.ReactionInvalid)
        const [message] = await this.store.messagesByIds(workspaceId, [messageId])
        if (message === undefined) return chatRefusal(TeamChatErrorCode.NotFound)
        const member = { memberKind: "user", memberId: viewerId } as const
        if ((await this.store.memberOf(message.roomId, member)) === null)
            return chatRefusal(TeamChatErrorCode.NotMember)
        const taps = tapsAcceptedOf(timesOf(times), await this.reactions.heldOf(message.id, member, canonical))
        if (taps === 0) return chatRefusal(TeamChatErrorCode.ReactionRateLimited)
        await this.reactions.addTaps(message, member, canonical, taps)
        return chatDone(await this.views.viewOf(workspaceId, message, viewerId))
    }
}
