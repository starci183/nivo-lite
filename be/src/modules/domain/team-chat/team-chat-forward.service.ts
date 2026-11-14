import { Injectable } from "@nestjs/common"
import { TeamChatErrorCode } from "./errors/team-chat.error"
import type { ChatRoomMessageEntity } from "./persistence/entities"
import { BODY_MAX, type MessageRef, type MessageView, type TeamChatResult } from "./team-chat.contracts"
import { chatDone, chatRefusal, isReadOnlyRoom } from "./team-chat.policy"
import { TeamChatAccessService } from "./team-chat-access.service"
import { TeamChatStoreService } from "./team-chat-store.service"
import { TeamChatViewsService } from "./team-chat-views.service"

/** The longest name a forwarded message keeps of its first author; the database check holds the same bound. */
const FORWARDED_NAME_MAX = 200

/** Whether a message is one a person may forward: a line of the system is not. */
const isForwardable = (message: ChatRoomMessageEntity): boolean => message.authorKind !== "system"

/** The ref of a forward: whose words these are, and the card of an agent when the message was one. */
const forwardRefOf = (message: ChatRoomMessageEntity, authorName: string): MessageRef => ({
    forwarded_from: (message.ref?.forwarded_from ?? authorName).slice(0, FORWARDED_NAME_MAX),
    ...(message.ref?.agent_message === undefined ? {} : { agent_message: message.ref.agent_message }),
})

@Injectable()
/**
 * Forwards a message into another room: the text and the agent card it carries are written as a new message of the person who
 * forwards, marked with whose words they are. The person must see the room the message is in and sit in the room it goes to.
 */
export class TeamChatForwardService {
    constructor(
        private readonly store: TeamChatStoreService,
        private readonly access: TeamChatAccessService,
        private readonly views: TeamChatViewsService,
    ) {}

    /** Writes the message into the target room as a new message of the viewer. */
    async forward(
        workspaceId: string,
        viewerId: string,
        messageId: string,
        toRoomId: string,
    ): Promise<TeamChatResult<MessageView>> {
        const [source] = await this.store.messagesByIds(workspaceId, [messageId])
        if (source === undefined || !isForwardable(source)) return chatRefusal(TeamChatErrorCode.NotFound)
        if ((await this.access.visibleRoom(workspaceId, viewerId, source.roomId)) === null)
            return chatRefusal(TeamChatErrorCode.NotFound)
        const target = await this.access.visibleRoom(workspaceId, viewerId, toRoomId)
        if (target === null) return chatRefusal(TeamChatErrorCode.NotFound)
        // A forward is a new line of the viewer: a read-only room (the founder's NIVO room) takes none.
        if (isReadOnlyRoom(target)) return chatRefusal(TeamChatErrorCode.Forbidden)
        if ((await this.store.memberOf(toRoomId, { memberKind: "user", memberId: viewerId })) === null)
            return chatRefusal(TeamChatErrorCode.NotMember)
        const body = source.body.slice(0, BODY_MAX)
        if (body.trim().length === 0) return chatRefusal(TeamChatErrorCode.BodyEmpty)
        const names = await this.views.namesOf(
            workspaceId,
            source.authorId === null || source.authorKind === "system"
                ? []
                : [{ memberKind: source.authorKind, memberId: source.authorId }],
        )
        const [authorName = ""] = names.values()
        const stored = await this.store.insertText({
            workspaceId,
            roomId: toRoomId,
            authorId: viewerId,
            body,
            clientId: null,
            mentions: [],
            attachments: [],
            ref: forwardRefOf(source, authorName),
        })
        await this.store.moveReadPosition(workspaceId, toRoomId, viewerId, stored.id)
        return chatDone(await this.views.viewOf(workspaceId, stored, viewerId))
    }
}
