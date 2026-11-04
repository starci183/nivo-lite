import { Field, InputType } from "@nestjs/graphql"
import {
    ArrayMaxSize,
    ArrayMinSize,
    IsArray,
    IsDateString,
    IsIn,
    IsOptional,
    IsString,
    MaxLength,
} from "class-validator"
import { NullAsAbsent } from "@modules/platform/graphql"

@InputType()
/** The consent of a real person to the persona of a template. */
export class RecordTemplateLikenessInput {
    /** The template key. */
    @Field(() => String)
    @IsString()
    @MaxLength(60)
    templateKey!: string

    /** The person. */
    @Field(() => String)
    @IsString()
    @MaxLength(120)
    personName!: string

    /** `name`, `avatar`, `voice_style` or `first_person`. */
    @Field(() => [String])
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(4)
    @IsIn(["name", "avatar", "voice_style", "first_person"], { each: true })
    allowedUses!: Array<"name" | "avatar" | "voice_style" | "first_person">

    /** The line shown to every customer. */
    @Field(() => String)
    @IsString()
    @MaxLength(300)
    disclosure!: string

    /** When the consent ends, ISO 8601. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsDateString()
    @MaxLength(40)
    expiresAt?: string
}
