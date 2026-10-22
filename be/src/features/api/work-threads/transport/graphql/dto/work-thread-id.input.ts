import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** The thread a read names. */
export class WorkThreadIdInput {
    /** The thread. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    threadId!: string
}
