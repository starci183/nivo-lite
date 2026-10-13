import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The Chatbot agent behind the onboarding checklist. */
export class DashboardPromoChatbotType {
    /** The agent id. */
    @Field(() => ID)
    id!: string

    /** Its knowledge text. */
    @Field()
    knowledge!: string
}
