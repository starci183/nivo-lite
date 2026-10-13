import { Field, ID, InputType } from "@nestjs/graphql"
import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator"
import { NullAsAbsent } from "@modules/platform/graphql"

@InputType()
/** Which document to read again, and the new text when it changed. */
export class ReindexKnowledgeSourceInput {
    /** The document. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    sourceId!: string

    /** The new text; omitted keeps the text. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MaxLength(120000)
    content?: string
}
