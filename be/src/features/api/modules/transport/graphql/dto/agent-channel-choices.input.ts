import { Field, InputType } from "@nestjs/graphql"
import { IsString, Matches, MaxLength } from "class-validator"

@InputType()
/** Names the role whose channel choices are read. */
export class AgentChannelChoicesInput {
    /** The role (module key). */
    @Field()
    @IsString()
    @Matches(/^[a-z][a-z0-9_]{1,23}$/u)
    @MaxLength(24)
    moduleKey!: string
}
