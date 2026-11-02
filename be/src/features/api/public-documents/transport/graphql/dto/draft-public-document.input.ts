import {
    ArrayMaxSize,
    ArrayMinSize,
    IsArray,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    MinLength,
} from "class-validator"
import { Field, ID, InputType } from "@nestjs/graphql"
import { NullAsAbsent } from "@modules/platform/graphql"

@InputType()
/** The internal documents NIVO drafts a public document from. */
export class DraftPublicDocumentInput {
    /** The title of the public document. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(160)
    title!: string

    /** The internal documents to draft from, at most five. */
    @Field(() => [ID])
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(5)
    @IsUUID(undefined, { each: true })
    @MaxLength(36, { each: true })
    sourceIds!: Array<string>

    /** A note for NIVO about what to write. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    instructions?: string
}
