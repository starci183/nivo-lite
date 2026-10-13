import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Whether the agent engine is usable, for the Agents page. */
export class AgentEngineStatusType {
    /** True when a gateway address and credential are configured. */
    @Field()
    gatewayConfigured!: boolean

    /** True when the agent workspaces can be written. */
    @Field()
    workspaceWritable!: boolean

    /** The last time a sync of the workspace ran, ISO 8601, or null when none ever did. */
    @Field(() => String, { nullable: true })
    lastSyncCheckAt?: string | null

    /** True when the last sync check is younger than the freshness window. */
    @Field()
    syncFresh!: boolean
}
