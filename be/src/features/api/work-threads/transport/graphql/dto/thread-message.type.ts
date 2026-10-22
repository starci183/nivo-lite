import { Field, ID, ObjectType } from "@nestjs/graphql"
import { ThreadMentionType } from "./thread-mention.type"
import { ThreadApprovalCardType } from "./thread-approval-card.type"

@ObjectType()
/** One message of a work thread. */
export class ThreadMessageType {
    /** The message id. */
    @Field(() => ID)
    id!: string

    /** The thread. */
    @Field(() => ID)
    threadId!: string

    /** member or agent. */
    @Field()
    authorKind!: string

    /** The author id. */
    @Field()
    authorId!: string

    /** The author's display name. */
    @Field()
    authorName!: string

    /** The member's role or the agent's module. */
    @Field()
    authorRole!: string

    /** What was written. */
    @Field()
    body!: string

    /** Customer words the author quoted: data, never a tag. */
    @Field(() => [String])
    quoted!: ReadonlyArray<string>

    /** The tags the author chose. */
    @Field(() => [ThreadMentionType])
    mentions!: ReadonlyArray<ThreadMentionType>

    /** The approval card the message carries. */
    @Field(() => ThreadApprovalCardType, { nullable: true })
    approval!: ThreadApprovalCardType | null

    /** When it was written, ISO 8601. */
    @Field()
    createdAt!: string
}
