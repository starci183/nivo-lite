import { Field, InputType, Int } from "@nestjs/graphql"
import { IsInt, IsString, IsUUID, MaxLength, Min } from "class-validator"

@InputType()
/** What saveAgentGraphDraft takes. */
export class SaveAgentGraphDraftInput {
    /** The agent. */
    @Field(() => String)
    @IsString()
    @MaxLength(36)
    @IsUUID()
    agentId!: string

    /** The revision of the draft the editor read. */
    @Field(() => Int)
    @IsInt()
    @Min(0)
    rev!: number

    /** The graph, as JSON text. */
    @Field(() => String)
    @IsString()
    @MaxLength(400000)
    documentJson!: string
}
