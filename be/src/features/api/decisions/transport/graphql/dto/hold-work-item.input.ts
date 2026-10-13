import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, IsUUID, MaxLength, MinLength } from "class-validator"

@InputType()
/** Keeps a waiting work item waiting, with a note. */
export class HoldWorkItemInput {
    /** The work item. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    workItemId!: string

    /** Why there is not enough basis yet. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(1000)
    note!: string
}
