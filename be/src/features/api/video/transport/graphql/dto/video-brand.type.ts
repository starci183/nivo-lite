import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Saved video-brand view. */
export class VideoBrandType {
    /** shopName of this video. */
    @Field(() => String)
    shopName!: string

    /** primary of this video. */
    @Field(() => String)
    primary!: string

    /** secondary of this video. */
    @Field(() => String)
    secondary!: string

    /** logoPath of this video. */
    @Field(() => String, { nullable: true })
    logoPath!: string | null

    /** musicTrack of this video. */
    @Field(() => String, { nullable: true })
    musicTrack!: string | null

    /** voice of this video. */
    @Field(() => String)
    voice!: string
}
