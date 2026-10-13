import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Saved video-scope view. */
export class VideoScopeType {
    /** workspaceId of this video. */
    @Field(() => ID)
    workspaceId!: string

    /** canEdit of this video. */
    @Field(() => Boolean)
    canEdit!: boolean
}
