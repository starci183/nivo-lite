import { Field, ID, InputType, Int } from "@nestjs/graphql"
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from "class-validator"

@InputType()
/** The bounded arguments that move a workspace to a plan. */
export class AdminSetWorkspacePlanInput {
    /** The workspace. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    workspaceId!: string

    /** The plan to move to. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(40)
    planCode!: string

    /** The workspace own monthly credits; null or absent clears it so the plan allowance applies. */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(100000000)
    creditsLimit: number | null = null
}
