import { Field, Float, InputType } from "@nestjs/graphql"
import { IsIn, IsNumber, IsOptional, IsString, IsUUID, Matches, MaxLength, Min } from "class-validator"

@InputType()
/** One agent's grant of a gateway tool. */
export class SetMcpToolGrantInput {
    /** The agent. */
    @Field(() => String)
    @IsUUID()
    agentId!: string

    /** The full tool name or connector.*. */
    @Field(() => String)
    @IsString()
    @Matches(/^[a-z][a-z0-9-]{1,30}\.([a-zA-Z][a-zA-Z0-9_.]{1,80}|\*)$/u)
    tool!: string

    /** auto, ask or never. */
    @Field(() => String)
    @IsIn(["auto", "ask", "never"])
    mode!: "auto" | "ask" | "never"

    /** The amount limit, or null. */
    @Field(() => Float, { nullable: true })
    @IsOptional()
    @IsNumber()
    @Min(0)
    limitVnd?: number | null

    /** The argument constraints as JSON: [{ "arg": "discountPct", "max": 5 }], or null for none. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    constraintsJson?: string | null
}
