import { Field, InputType } from "@nestjs/graphql"
import { IsString, Matches, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments of wantConnector. */
export class WantConnectorInput {
    /** The planned connector. */
    @Field(() => String)
    @IsString()
    @MaxLength(60)
    @Matches(/^[a-z0-9_]{1,60}$/u)
    connectorId!: string
}
