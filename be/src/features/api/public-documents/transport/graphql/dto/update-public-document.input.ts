import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator"
import { Field, ID, InputType } from "@nestjs/graphql"
import { NullAsAbsent } from "@modules/platform/graphql"

@InputType()
/** A change to the title or the text of a public document. */
export class UpdatePublicDocumentInput {
    /** The public document. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    id!: string

    /** A new title. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(160)
    title?: string

    /** A new text. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MaxLength(40000)
    body?: string
}
