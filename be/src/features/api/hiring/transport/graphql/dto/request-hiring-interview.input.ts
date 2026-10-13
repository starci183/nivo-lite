import { Field, ID, Int, InputType } from "@nestjs/graphql"
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator"

@InputType()
/** The bounded arguments that arrange an interview for a candidate. */
export class RequestHiringInterviewInput {
    /** The candidate. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    candidateId!: string

    /** The member who interviews; absent means the owner. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    interviewerUserId?: string

    /** In person or online. */
    @Field(() => String)
    @IsIn(["in_person", "online"])
    mode!: "in_person" | "online"

    /** The address, or the online link. */
    @Field(() => String)
    @IsString()
    @MaxLength(500)
    location!: string

    /** The length in minutes. */
    @Field(() => Int)
    @IsInt()
    @Min(5)
    @Max(480)
    durationMin!: number
}
