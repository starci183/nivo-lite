import { Field, InputType } from "@nestjs/graphql"
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator"
import { NullAsAbsent } from "@modules/platform/graphql"

@InputType()
/** Which documents to list. */
export class KnowledgeSourcesInput {
    /** Only the documents of this module. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(64)
    module?: string

    /** Only the documents that came from this origin, e.g. `google_drive`. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(64)
    origin?: string
}
