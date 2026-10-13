import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** Reads the queued escalation decision and its answer delivery. */
export class ChatAnswerStatusInput {
    /** The work item id. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    workItemId!: string
}
