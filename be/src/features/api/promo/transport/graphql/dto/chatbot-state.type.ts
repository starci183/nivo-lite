import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The installed chatbot used by promo surfaces. */
export class PromoChatbotStateType {
    /** Whether the workspace has a chatbot. */
    @Field()
    hasChatbot!: boolean

    /** The chatbot identifier. */
    @Field(() => ID, { nullable: true })
    agentId!: string | null

    /** The chatbot handle. */
    @Field(() => String, { nullable: true })
    handle!: string | null

    /** The chatbot display name. */
    @Field(() => String, { nullable: true })
    name!: string | null
}
