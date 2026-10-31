import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** Names a task to close. */
export class CloseAgentTaskInput {
    /** The agent instance. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    installationId!: string

    /** The task. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    taskId!: string
}
