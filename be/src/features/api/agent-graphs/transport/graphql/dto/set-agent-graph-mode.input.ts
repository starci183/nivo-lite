import { Field, InputType } from "@nestjs/graphql"
import { IsIn, IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** What setAgentGraphMode takes. */
export class SetAgentGraphModeInput {
    /** The agent. */
    @Field(() => String)
    @IsString()
    @MaxLength(36)
    @IsUUID()
    agentId!: string

    /** shadow records only, enforced decides. */
    @Field(() => String)
    @IsIn(["shadow", "enforced"])
    mode!: "shadow" | "enforced"
}
