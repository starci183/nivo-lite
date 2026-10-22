import { Field, ID, InputType } from "@nestjs/graphql"
import { IsOptional, IsUUID, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments of the thread list. */
export class ListWorkThreadsInput {
    /** Only threads about this lead; absent or null lists every thread of the workspace. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    leadId: string | null = null
}
