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

    /**
     * A new upload of the same document (the path createKnowledgeUpload gave), for a file document: the new file is read in place of
     * the old one and only the passages whose text changed are embedded and read for facts again. Omitted keeps the file.
     */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MaxLength(400)
    storagePath?: string
}
