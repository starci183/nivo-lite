import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Saved video-figures view. */
export class VideoFiguresType {
    /** rendering of this video. */
    @Field(() => Int)
    rendering!: number

    /** scripting of this video. */
    @Field(() => Int)
    scripting!: number

    /** readyToPublish of this video. */
    @Field(() => Int)
    readyToPublish!: number

    /** approved of this video. */
    @Field(() => Int)
    approved!: number

    /** published30 of this video. */
    @Field(() => Int)
    published30!: number

    /** credits30 of this video. */
    @Field(() => Int)
    credits30!: number
}
