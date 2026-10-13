import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** Names one candidate of the caller's workspace. */
export class HiringCandidateRefInput {
    /** The candidate. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    id!: string
}
