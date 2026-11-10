import { Field, InputType } from "@nestjs/graphql"
import { IsString, Matches, MaxLength } from "class-validator"

@InputType()
/** The provider whose template candidates are asked for. */
export class ProviderTemplateCandidatesInput {
    /** The provider key. */
    @Field(() => String)
    @IsString()
    @MaxLength(31)
    @Matches(/^[a-z][a-z0-9_-]{1,30}$/u)
    provider!: string
}
