import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One sync of a data connection, as the owner polls it. */
export class DataSyncRunType {
    /** The run id. */
    @Field(() => ID)
    id!: string

    /** The connection it syncs. */
    @Field(() => ID)
    connectionId!: string

    /** How it started: schedule, manual, upload or push. */
    @Field(() => String)
    trigger!: string

    /** Where it is: running, ok or failed. */
    @Field(() => String)
    state!: string

    /** How many rows it wrote. */
    @Field(() => Int)
    rows!: number

    /** The failure the owner reads, when it failed. */
    @Field(() => String, { nullable: true })
    error!: string | null

    /** When it started, ISO 8601. */
    @Field(() => String)
    startedAt!: string

    /** When it ended, ISO 8601; null while it runs. */
    @Field(() => String, { nullable: true })
    finishedAt!: string | null
}
