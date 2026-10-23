import { Field, Float, ID, InputType } from "@nestjs/graphql"
import { IsNumber, IsOptional, IsString, IsUUID, Matches, MaxLength, Min, MinLength } from "class-validator"

@InputType()
/** Hands an agent work. */
export class AssignAgentWorkInput {
    /** The agent. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    agentId!: string

    /** What to do, as the person wrote it. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(4000)
    text!: string

    /** The action the agent starts on (an action of its department); absent for a request it only reads. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @MaxLength(41)
    @Matches(/^[a-z][a-z0-9_]{2,40}$/)
    action?: string | null

    /** The amount in the unit of the action's rule (a percentage, a count or VND). */
    @Field(() => Float, { nullable: true })
    @IsOptional()
    @IsNumber()
    @Min(0)
    amount?: number | null

    /** The value of the deal, VND. */
    @Field(() => Float, { nullable: true })
    @IsOptional()
    @IsNumber()
    @Min(0)
    amountVnd?: number | null

    /** The customer the work is about; required with an action. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    leadId?: string | null
}
