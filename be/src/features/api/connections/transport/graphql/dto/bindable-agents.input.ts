import { Field, InputType } from "@nestjs/graphql"
import { IsString, Matches, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments of bindableAgents. */
export class BindableAgentsInput {
    /** The provider a connection would be of. */
    @Field(() => String)
    @IsString()
    @MaxLength(60)
    @Matches(/^[a-z0-9_]{1,60}$/u)
    provider!: string
}
