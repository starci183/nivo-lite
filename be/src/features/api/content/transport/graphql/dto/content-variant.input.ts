import { Field, InputType } from "@nestjs/graphql"
import { IsIn, IsString, MaxLength, IsArray, ArrayMaxSize } from "class-validator"

@InputType()
/** A bounded content-variant input. */
export class ContentVariantInput {
    /** The channel field. */
    @Field()
    @IsIn(["facebook", "zalo", "tiktok", "instagram"])
    @MaxLength(32)
    channel!: string
    /** The text field. */
    @Field()
    @IsString()
    @MaxLength(6000)
    text!: string
    /** The hashtags field. */
    @Field(() => [String])
    @IsArray()
    @ArrayMaxSize(30)
    @IsString({ each: true })
    @MaxLength(80, { each: true })
    hashtags!: Array<string>
    /** The note field. */
    @Field()
    @IsString()
    @MaxLength(600)
    note!: string
}
