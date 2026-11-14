import { Field, InputType } from "@nestjs/graphql"
import { IsString, Matches, MaxLength } from "class-validator"

@InputType()
/** The module of the agent whose default attachments are asked for. */
export class AgentAbilityProposalInput {
    /** The module key. */
    @Field(() => String)
    @IsString()
    @MaxLength(24)
    @Matches(/^[a-z][a-z0-9_]{1,23}$/u)
    moduleKey!: string
}
