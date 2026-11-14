import { Field, Float, InputType } from "@nestjs/graphql"
import { IsIn, IsNumber, IsOptional, Max, MaxLength, Min } from "class-validator"
import {
    WORKSPACE_THEME_FONTS,
    WORKSPACE_THEME_MODES,
    WORKSPACE_THEME_RADII,
    WORKSPACE_THEME_RANGES,
    WORKSPACE_THEME_WORD_MAX,
} from "@modules/domain/workspace-settings"

@InputType()
/** The theme a manager saves: all six parameters, each checked by range or list before anything is written. */
export class UpdateWorkspaceThemeInput {
    /** The accent hue, 0 to 360. */
    @Field(() => Float)
    @IsNumber()
    @Min(WORKSPACE_THEME_RANGES.hue.min)
    @Max(WORKSPACE_THEME_RANGES.hue.max)
    hue!: number

    /** The accent chroma, 0 to 0.37. */
    @Field(() => Float)
    @IsNumber()
    @Min(WORKSPACE_THEME_RANGES.chroma.min)
    @Max(WORKSPACE_THEME_RANGES.chroma.max)
    chroma!: number

    /** The accent lightness as a fraction, 0.2 to 0.95. */
    @Field(() => Float)
    @IsNumber()
    @Min(WORKSPACE_THEME_RANGES.lightness.min)
    @Max(WORKSPACE_THEME_RANGES.lightness.max)
    lightness!: number

    /** How much the neutrals lean to the hue, 0 to 1. */
    @Field(() => Float)
    @IsNumber()
    @Min(WORKSPACE_THEME_RANGES.base.min)
    @Max(WORKSPACE_THEME_RANGES.base.max)
    base!: number

    /** One of the curated fonts. */
    @Field()
    @IsIn(WORKSPACE_THEME_FONTS)
    @MaxLength(WORKSPACE_THEME_WORD_MAX)
    font!: string

    /** One of the corner steps. */
    @Field()
    @IsIn(WORKSPACE_THEME_RADII)
    @MaxLength(WORKSPACE_THEME_WORD_MAX)
    radius!: string

    /** The mode the console opens in; absent or null follows the person's own choice. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsIn(WORKSPACE_THEME_MODES)
    @MaxLength(WORKSPACE_THEME_WORD_MAX)
    mode?: string | null
}
