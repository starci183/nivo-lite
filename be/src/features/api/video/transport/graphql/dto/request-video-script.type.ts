import { ObjectType, Field } from "@nestjs/graphql"

@ObjectType()
/** A queued script operation that returns before the agent runs. */
export class RequestVideoScriptType {
    /** Stable polling id. */
    @Field()
    id!: string

    /** Project to refresh after completion. */
    @Field()
    projectId!: string

    /** Queued or running. */
    @Field()
    status!: string
}
