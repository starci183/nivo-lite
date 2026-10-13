import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Saved video-inputs view. */
export class VideoInputsType {
    /** sourceIds of this video. */
    @Field(() => [ID])
    sourceIds!: Array<string>

    /** notes of this video. */
    @Field(() => String)
    notes!: string

    /** media of this video. */
    @Field(() => [String])
    media!: Array<string>

    /** auto of this video. */
    @Field(() => Boolean)
    auto!: boolean
}
