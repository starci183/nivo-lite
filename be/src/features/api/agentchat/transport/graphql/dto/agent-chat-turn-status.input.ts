import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** Bounded arguments for AgentChatTurnStatus. */
export class AgentChatTurnStatusInput {
    /** The id argument. */
    @Field(() => ID)
    @IsUUID("all")
    @MaxLength(36)
    id!: string
}
