import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** Names a trigger to remove. */
export class RemoveAgentTriggerInput {
    /** The agent instance. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    installationId!: string

    /** The trigger. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    triggerId!: string
}
