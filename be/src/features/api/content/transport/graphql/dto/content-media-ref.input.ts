import { Field, InputType } from "@nestjs/graphql"
import { IsIn, IsString, MaxLength, IsOptional, IsUUID, IsBoolean } from "class-validator"

@InputType()
/** A bounded content-media-ref input. */
export class ContentMediaRefInput {
    /** The kind field. */
    @Field()
    @IsIn(["media", "video_render"])
    @MaxLength(16)
    kind!: string
    /** The name field. */
    @Field()
    @IsString()
    @MaxLength(255)
    name!: string
    /** The path field. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(1024)
    path?: string | null
    /** The id field. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsUUID()
    @MaxLength(36)
    id?: string | null
    /** The suggested field. */
    @Field(() => Boolean, { nullable: true })
    @IsOptional()
    @IsBoolean()
    suggested?: boolean | null
}
