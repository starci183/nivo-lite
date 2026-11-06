import { Field, ID, ObjectType } from "@nestjs/graphql"
import { ChatMessageKind } from "./chat-message-kind.type"
import { ChatAuthorKind } from "./chat-author-kind.type"
import { ChatMentionType } from "./chat-mention.type"
import { ChatAttachmentType } from "./chat-attachment.type"
import { ChatReportRefType } from "./chat-report-ref.type"
import { ChatApprovalType } from "./chat-approval.type"

@ObjectType()
/** One message of a room. */
export class ChatMessageType {
    /** The message. */
    @Field(() => ID)
    id!: string

    /** The room. */
    @Field(() => ID)
    roomId!: string

    /** Text, report, approval or system. */
    @Field(() => ChatMessageKind)
    kind!: string

    /** Who wrote it. */
    @Field(() => ChatAuthorKind)
    authorKind!: string

    /** The author; null for a system line. */
    @Field(() => ID, { nullable: true })
    authorId!: string | null

    /** The name of the author. */
    @Field(() => String)
    authorName!: string

    /** The text. */
    @Field(() => String)
    body!: string

    /** When it was written. */
    @Field(() => String)
    createdAt!: string

    /** When it was edited. */
    @Field(() => String, { nullable: true })
    editedAt!: string | null

    /** Whether it is pinned in its room. */
    @Field(() => Boolean)
    pinned!: boolean

    /** Who it mentions. */
    @Field(() => [ChatMentionType])
    mentions!: ReadonlyArray<ChatMentionType>

    /** The files it carries. */
    @Field(() => [ChatAttachmentType])
    attachments!: ReadonlyArray<ChatAttachmentType>

    /** Set when it is a report. */
    @Field(() => ChatReportRefType, { nullable: true })
    report!: ChatReportRefType | null

    /** Set when it is an approval card. */
    @Field(() => ChatApprovalType, { nullable: true })
    approval!: ChatApprovalType | null
}
