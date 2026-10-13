import { Field, InputType } from "@nestjs/graphql"
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator"

@InputType()
/** Editable script scene. */
export class VideoSceneInput {
    /** id of this scene. */
    @Field(() => String)
    @IsString()
    @MaxLength(60)
    id!: string

    /** role of this scene. */
    @Field(() => String)
    @IsIn(["hook", "body", "cta"])
    @MaxLength(10)
    role!: string

    /** caption of this scene. */
    @Field(() => String)
    @IsString()
    @MaxLength(160)
    caption!: string

    /** voiceover of this scene. */
    @Field(() => String)
    @IsString()
    @MaxLength(420)
    voiceover!: string

    /** visual of this scene. */
    @Field(() => String)
    @IsString()
    @MaxLength(240)
    visual!: string

    /** media of this scene. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(300)
    media!: string | null
}
