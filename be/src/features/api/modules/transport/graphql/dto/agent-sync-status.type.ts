import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The OpenClaw copy of an agent against the context version that is active. */
export class AgentSyncStatusType {
    /** `none`, `ok` or `error`. */
    @Field()
    state!: string

    /** The context version OpenClaw holds; null when there is no copy. */
    @Field(() => Int, { nullable: true })
    syncedVersion?: number | null

    /** The context version that is active in the database. */
    @Field(() => Int, { nullable: true })
    activeVersion?: number | null

    /** When the copy was last checked, ISO 8601. */
    @Field(() => String, { nullable: true })
    checkedAt?: string | null

    /** The last failure, when the last sync failed. */
    @Field(() => String, { nullable: true })
    error?: string | null
}
