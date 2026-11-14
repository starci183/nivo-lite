import { Field, ObjectType } from "@nestjs/graphql"
import { AgentWorkflowReadinessBlockType } from "./agent-workflow-readiness-block.type"
import { AgentWorkflowReconnectType } from "./agent-workflow-reconnect.type"

@ObjectType()
/**
 * Whether a workflow's graph shows for its agent (readiness): hidden while a blocking step lists providers none of which is connected
 * (no trigger, no call reaches it), or shown with the side steps that are skipped for the same reason.
 */
export class AgentWorkflowReadinessType {
    /** True while the workflow is hidden: it does not run until one of `waitingFor` is connected. */
    @Field(() => Boolean)
    hidden!: boolean

    /** The providers a hidden workflow waits for, by key (`zalo_oa`, `sepay`); empty when it shows. */
    @Field(() => [String])
    waitingFor!: ReadonlyArray<string>

    /** Why each provider keeps a hidden workflow hidden, one entry per provider and reason; empty when it shows. */
    @Field(() => [AgentWorkflowReadinessBlockType])
    blocked!: ReadonlyArray<AgentWorkflowReadinessBlockType>

    /** The agent's attached accounts whose provider refused the credential, shown or hidden alike; informative, nothing is hidden for it. */
    @Field(() => [AgentWorkflowReconnectType])
    reconnect!: ReadonlyArray<AgentWorkflowReconnectType>

    /** The keys of the side steps a shown workflow skips (none of their providers connected); empty when it is hidden. */
    @Field(() => [String])
    skipped!: ReadonlyArray<string>
}
