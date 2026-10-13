import { Field, ID, Int, ObjectType } from "@nestjs/graphql"
import { VideoInputsType } from "./video-inputs.type"
import { VideoSceneType } from "./video-scene.type"
import { VideoRenderType } from "./video-render.type"

@ObjectType()
/** Saved video-project view. */
export class VideoProjectType {
    /** id of this video. */
    @Field(() => ID)
    id!: string

    /** title of this video. */
    @Field(() => String)
    title!: string

    /** goal of this video. */
    @Field(() => String)
    goal!: string

    /** aspect of this video. */
    @Field(() => String)
    aspect!: string

    /** targetSeconds of this video. */
    @Field(() => Int)
    targetSeconds!: number

    /** status of this video. */
    @Field(() => String)
    status!: string

    /** inputs of this video. */
    @Field(() => VideoInputsType)
    inputs!: VideoInputsType

    /** script of this video. */
    @Field(() => [VideoSceneType])
    script!: Array<VideoSceneType>

    /** version of this video. */
    @Field(() => Int)
    version!: number

    /** scriptMs of this video. */
    @Field(() => Int, { nullable: true })
    scriptMs!: number | null

    /** lastErrorCode of this video. */
    @Field(() => String, { nullable: true })
    lastErrorCode!: string | null

    /** render of this video. */
    @Field(() => VideoRenderType, { nullable: true })
    render!: VideoRenderType | null

    /** renderCount of this video. */
    @Field(() => Int)
    renderCount!: number

    /** approvedAt of this video. */
    @Field(() => String, { nullable: true })
    approvedAt!: string | null

    /** approvedByName of this video. */
    @Field(() => String, { nullable: true })
    approvedByName!: string | null

    /** publishedAt of this video. */
    @Field(() => String, { nullable: true })
    publishedAt!: string | null

    /** createdAt of this video. */
    @Field(() => String)
    createdAt!: string

    /** updatedAt of this video. */
    @Field(() => String)
    updatedAt!: string
}
