import { Field, ObjectType } from "@nestjs/graphql"
import { WorkspaceDashboardAgentType } from "./workspace-dashboard-agent.type"
import { WorkspaceDashboardApprovalsType } from "./workspace-dashboard-approvals.type"
import { WorkspaceDashboardComparedType } from "./workspace-dashboard-compared.type"
import { WorkspaceDashboardPeriod } from "./workspace-dashboard-period.type"
import { WorkspaceDashboardRateType } from "./workspace-dashboard-rate.type"
import { WorkspaceDashboardSavingsType } from "./workspace-dashboard-savings.type"

@ObjectType()
/** The owner dashboard for one period: the engine's own figures (conversations, contacts, runs, what waits, what the agents did), no module's records. */
export class WorkspaceDashboardType {
    /** The period read. */
    @Field(() => WorkspaceDashboardPeriod)
    period!: string

    /** The first instant of the period, ISO 8601. */
    @Field()
    from!: string

    /** The first instant after the period, ISO 8601. */
    @Field()
    to!: string

    /** Conversations with a line said. */
    @Field(() => WorkspaceDashboardComparedType)
    conversations!: WorkspaceDashboardComparedType

    /** New contacts: conversations opened, one per channel identity. */
    @Field(() => WorkspaceDashboardComparedType)
    newContacts!: WorkspaceDashboardComparedType

    /** Runs that finished. */
    @Field(() => WorkspaceDashboardComparedType)
    runsDone!: WorkspaceDashboardComparedType

    /** Runs that failed or were handed to a person. */
    @Field(() => WorkspaceDashboardComparedType)
    runsFailed!: WorkspaceDashboardComparedType

    /** Items finished by policy alone over items finished. */
    @Field(() => WorkspaceDashboardRateType)
    agentAutoRate!: WorkspaceDashboardRateType

    /** The items that wait for the owner. */
    @Field(() => WorkspaceDashboardApprovalsType)
    approvals!: WorkspaceDashboardApprovalsType

    /** What the agents did. */
    @Field(() => WorkspaceDashboardSavingsType)
    savings!: WorkspaceDashboardSavingsType

    /** The installed agents. */
    @Field(() => [WorkspaceDashboardAgentType])
    agents!: Array<WorkspaceDashboardAgentType>
}
