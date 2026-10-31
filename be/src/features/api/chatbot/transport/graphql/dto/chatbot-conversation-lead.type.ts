import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The customer record behind a conversation in the list: the stage, the need and the company. */
export class ChatbotConversationLeadType {
    /** The journey stage of the customer. */
    @Field(() => String)
    stage!: string

    /** What the customer needs. */
    @Field(() => String)
    need!: string

    /** The customer's company, empty when unknown. */
    @Field(() => String)
    company!: string
}
