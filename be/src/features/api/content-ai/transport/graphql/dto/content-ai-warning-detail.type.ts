import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A pre-approval claim or channel-length finding. */
export class ContentAiWarningDetailType {
    /** promise, figure, or length. */
    @Field()
    kind!: string

    /** An unsupported promise phrase. */
    @Field(() => String, { nullable: true })
    phrase!: string | null

    /** An ungrounded numerical claim. */
    @Field(() => String, { nullable: true })
    figure!: string | null

    /** The generated text length. */
    @Field(() => Int, { nullable: true })
    length!: number | null

    /** The channel's configured limit. */
    @Field(() => Int, { nullable: true })
    max!: number | null
}
