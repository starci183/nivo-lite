import { Field, ID, InputType } from "@nestjs/graphql"
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator"
import { BRAIN_PROBE_TOOLS } from "@modules/domain/native-tools"

@InputType()
/** One Brain read tool to run as an agent, with the arguments the model would write. */
export class ProbeAgentSearchInput {
    /** The agent the tool is run as: its module and instance give the lens. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    agentId!: string

    /** The tool id: one of the Brain reads every AI step holds (search, facts, passages). */
    @Field(() => String)
    @IsIn([...BRAIN_PROBE_TOOLS])
    @MaxLength(80)
    tool!: string

    /** The arguments as the model would write them: the text of one JSON object. */
    @Field(() => String)
    @IsString()
    @MinLength(2)
    @MaxLength(4000)
    arguments!: string

    /** A customer conversation the call would serve: the lens then narrows to the public, as in a customer turn. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID()
    @MaxLength(36)
    conversationId?: string | null
}
