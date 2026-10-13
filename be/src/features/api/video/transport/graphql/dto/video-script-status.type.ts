import { ObjectType, Field, Int } from "@nestjs/graphql"

@ObjectType()
/** Script operation progress with a terminal result or stable failure code. */
export class VideoScriptStatusType {
    /** Stable polling id. */
    @Field()
    id!: string

    /** Project being scripted. */
    @Field()
    projectId!: string

    /** Queued, running, succeeded or failed. */
    @Field()
    status!: string

    /** Coarse completion percent. */
    @Field(() => Int)
    progress!: number

    /** Updated project on successful completion. */
    @Field(() => String, { nullable: true })
    resultId!: string | null

    /** Stable error code on failure. */
    @Field(() => String, { nullable: true })
    errorCode!: string | null
}
