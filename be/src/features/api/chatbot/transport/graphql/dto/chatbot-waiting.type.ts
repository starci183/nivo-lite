import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A customer reply that waits for a person. */
export class ChatbotWaitingType {
    /** The work item that waits. */
    @Field(() => ID)
    workItemId!: string

    /** The conversation it answers in. */
    @Field(() => ID)
    conversationId!: string

    /** The channel of that conversation. */
    @Field(() => String)
    channel!: string

    /** The customer's name. */
    @Field(() => String)
    name!: string

    /** What the customer asked. */
    @Field(() => String)
    question!: string

    /** The AI's draft answer, empty when it wrote none. */
    @Field(() => String)
    draft!: string

    /** The staff member the reply was assigned to. */
    @Field(() => String, { nullable: true })
    staffName!: string | null

    /** When it began to wait. */
    @Field(() => String)
    since!: string
}
