import { Field, Float, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The brand theme parameters of the workspace behind a site key: parameters only, no workspace data. */
export class WebsiteThemeType {
    /** The accent hue, 0 to 360. */
    @Field(() => Float)
    hue!: number

    /** The accent chroma, 0 to 0.37. */
    @Field(() => Float)
    chroma!: number

    /** The accent lightness as a fraction. */
    @Field(() => Float)
    lightness!: number

    /** How much the neutrals lean to the hue. */
    @Field(() => Float)
    base!: number

    /** One of the curated fonts. */
    @Field()
    font!: string

    /** One of the corner steps. */
    @Field()
    radius!: string

    /** The mode the page opens in; null follows the visitor. */
    @Field(() => String, { nullable: true })
    mode!: string | null
}
