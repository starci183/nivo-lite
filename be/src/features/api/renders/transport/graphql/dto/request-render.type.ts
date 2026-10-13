import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The queued render and its project, ready for status polling. */
export class RequestVideoRenderType {
    /** The render id used by the status query. */
    @Field(() => ID)
    id!: string
    /** The render id used by project records. */
    @Field(() => ID)
    renderId!: string
    /** The project whose render was queued. */
    @Field(() => ID)
    projectId!: string
    /** The immediate job state. */
    @Field()
    status!: string
}
