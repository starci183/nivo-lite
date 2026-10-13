import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** Names one queued text. */
export class AgentGenerationIdInput {
    /** The queued text. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    generationId!: string
}
