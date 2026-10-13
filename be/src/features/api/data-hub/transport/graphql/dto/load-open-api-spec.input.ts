import { Field, InputType } from "@nestjs/graphql"
import { IsString, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments of loadOpenApiSpec. */
export class LoadOpenApiSpecInput {
    /** A link to the spec (https). */
    @Field(() => String)
    @IsString()
    @MaxLength(1000)
    specUrl!: string

    /** The pasted spec (JSON or YAML, at most 5 MB); wins over the link when not blank. */
    @Field(() => String)
    @IsString()
    @MaxLength(5_000_000)
    specText!: string
}
