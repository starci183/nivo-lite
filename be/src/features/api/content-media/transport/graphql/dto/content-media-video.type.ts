import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A completed video available to the content workbench. */
export class ContentMediaVideoType {
    /** The video id. */
    @Field(() => ID)
    id!: string

    /** The video name displayed to the user. */
    @Field()
    name!: string

    /** When the video was created, ISO 8601. */
    @Field()
    createdAt!: string

    /** The duration in milliseconds, when known. */
    @Field(() => Int, { nullable: true })
    durationMs!: number | null
}
