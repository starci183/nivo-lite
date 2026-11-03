import { Field, InputType } from "@nestjs/graphql"
import { IsString, MaxLength } from "class-validator"

@InputType()
/** A text in both product languages. */
export class TemplateTextInput {
    /** The Vietnamese text. */
    @Field(() => String)
    @IsString()
    @MaxLength(400)
    vi!: string

    /** The English text. */
    @Field(() => String)
    @IsString()
    @MaxLength(400)
    en!: string
}
