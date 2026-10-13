import { Field, ID, InputType } from "@nestjs/graphql"
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments that move a candidate to another stage. */
export class MoveHiringCandidateInput {
    /** The candidate. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    id!: string

    /** The new stage. */
    @Field(() => String)
    @IsIn(["applied", "screening", "shortlisted", "interview", "offer", "hired", "rejected", "withdrawn"])
    stage!: "applied" | "screening" | "shortlisted" | "interview" | "offer" | "hired" | "rejected" | "withdrawn"

    /** Why the candidate is rejected. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    reason?: string
}
