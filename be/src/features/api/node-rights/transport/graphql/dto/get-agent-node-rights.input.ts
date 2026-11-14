import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments of agentNodeRights. */
export class GetAgentNodeRightsInput {
    /** The agent whose rights page is read. */
    @Field(() => ID)
    @IsString()
    @MaxLength(36)
    @IsUUID()
    agentId!: string
}
