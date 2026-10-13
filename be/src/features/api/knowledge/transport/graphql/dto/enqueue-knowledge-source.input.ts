import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator"
import { Field, ID, InputType } from "@nestjs/graphql"
import { NullAsAbsent } from "@modules/platform/graphql"

@InputType()
/** The document to add: a note, a Q&A list, an uploaded file or a link. */
export class EnqueueKnowledgeSourceInput {
    /** `text`, `faq`, `file` or `url`. */
    @Field(() => String)
    @IsIn(["text", "faq", "file", "url"])
    @MaxLength(40)
    kind!: string

    /** The title; a link or file without one is titled from its address or name. */
    @Field(() => String)
    @IsString()
    @MaxLength(300)
    title!: string

    /** The text of a note or Q&A list. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MaxLength(120000)
    content?: string

    /** The address of a link document. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(2048)
    url?: string

    /** The storage object of an uploaded file: `<workspaceId>/<uuid>/<filename>`. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(1024)
    storagePath?: string

    /** The topic label. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MaxLength(200)
    topic?: string

    /** The tags. */
    @Field(() => [String], { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(30)
    @IsString({ each: true })
    @MaxLength(60, { each: true })
    tags?: Array<string>

    /** The module (agent type) it is for; omitted = every module. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(64)
    module?: string

    /** The agent instance that alone reads it; omitted = every instance. */
    @Field(() => ID, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsUUID()
    @MaxLength(36)
    installationId?: string

    /** `public` or `internal`; internal when omitted. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsIn(["public", "internal"])
    @MaxLength(40)
    visibility?: string

    /** Where it came from: a folder, a ZIP or the Google Picker. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(40)
    origin?: string
}
