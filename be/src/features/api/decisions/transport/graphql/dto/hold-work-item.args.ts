import { ArgsType, Field, ID } from "@nestjs/graphql"
import { IsString, IsUUID, MaxLength, MinLength } from "class-validator"

@ArgsType()
/** Keeps a waiting work item waiting. */
export class HoldWorkItemArgs {
    /** The work item. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    workItemId!: string

    /** Why it should keep waiting. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(2000)
    note!: string
}
