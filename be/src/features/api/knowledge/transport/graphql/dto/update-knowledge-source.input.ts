import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator"
import { Field, ID, InputType } from "@nestjs/graphql"
import { NullAsAbsent } from "@modules/platform/graphql"

@InputType()
/** Which document to change and what changes. */
export class UpdateKnowledgeSourceInput {
    /** The document. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    sourceId!: string

    /** A new title. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MaxLength(300)
    title?: string

    /** A new topic; an empty text clears it. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MaxLength(200)
    topic?: string

    /** New tags. */
    @Field(() => [String], { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(30)
    @IsString({ each: true })
    @MaxLength(60, { each: true })
    tags?: Array<string>

    /** A new module; an empty text means every module. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MaxLength(64)
    module?: string

    /** `public` or `internal`. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsIn(["public", "internal"])
    @MaxLength(40)
    visibility?: string
}
