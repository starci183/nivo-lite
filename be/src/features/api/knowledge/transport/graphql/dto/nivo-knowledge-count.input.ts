import { Field, InputType } from "@nestjs/graphql"
import { IsString, MaxLength, MinLength } from "class-validator"

@InputType()
/** Names the module whose base knowledge is counted. */
export class NivoKnowledgeCountInput {
    /** The module folder, for example `chatbot`. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(40)
    module!: string
}
