import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** Selects the customer conversation to inspect. */
export class ChatbotThreadInput {
    /** The conversation id, scoped to the selected workspace. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    conversationId!: string
}
