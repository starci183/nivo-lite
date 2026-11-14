import { Field, Float, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The brand theme of a workspace in the parameters of the HeroUI theme builder; the console derives every colour from them. */
export class WorkspaceThemeType {
    /** The accent hue, 0 to 360. */
    @Field(() => Float)
    hue!: number

    /** The accent chroma, 0 to 0.37. */
    @Field(() => Float)
    chroma!: number

    /** The accent lightness as a fraction, 0.2 to 0.95. */
    @Field(() => Float)
    lightness!: number

    /** How much the neutrals lean to the hue, 0 to 1. */
    @Field(() => Float)
    base!: number

    /** One of the curated fonts. */
    @Field()
    font!: string

    /** One of the corner steps. */
    @Field()
    radius!: string

    /** The mode the console opens in; null follows the person's own choice. */
    @Field(() => String, { nullable: true })
    mode!: string | null
}
