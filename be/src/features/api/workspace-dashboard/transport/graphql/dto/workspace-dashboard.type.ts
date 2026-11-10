import { Field, ObjectType } from "@nestjs/graphql"
import { WorkspaceDashboardAgentType } from "./workspace-dashboard-agent.type"
import { WorkspaceDashboardApprovalsType } from "./workspace-dashboard-approvals.type"
import { WorkspaceDashboardChannelType } from "./workspace-dashboard-channel.type"
import { WorkspaceDashboardComparedType } from "./workspace-dashboard-compared.type"
import { WorkspaceDashboardDayType } from "./workspace-dashboard-day.type"
import { WorkspaceDashboardFunnelType } from "./workspace-dashboard-funnel.type"
import { WorkspaceDashboardPeriod } from "./workspace-dashboard-period.type"
import { WorkspaceDashboardRateType } from "./workspace-dashboard-rate.type"
import { WorkspaceDashboardSavingsType } from "./workspace-dashboard-savings.type"

@ObjectType()
/** The owner business dashboard for one period: takings, orders, customers, funnel, channels, what waits, what the agents did. */
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

    /** Matched payments, VND. */
    @Field(() => WorkspaceDashboardComparedType)
    revenue!: WorkspaceDashboardComparedType

    /** Orders placed. */
    @Field(() => WorkspaceDashboardComparedType)
    orders!: WorkspaceDashboardComparedType

    /** Leads created. */
    @Field(() => WorkspaceDashboardComparedType)
    newCustomers!: WorkspaceDashboardComparedType

    /** Paid orders over leads. */
    @Field(() => WorkspaceDashboardRateType)
    closeRate!: WorkspaceDashboardRateType

    /** Items finished by policy alone over items finished. */
    @Field(() => WorkspaceDashboardRateType)
    agentAutoRate!: WorkspaceDashboardRateType

    /** The days of the chart, oldest first; at least the last seven. */
    @Field(() => [WorkspaceDashboardDayType])
    days!: Array<WorkspaceDashboardDayType>

    /** The sales funnel. */
    @Field(() => WorkspaceDashboardFunnelType)
    funnel!: WorkspaceDashboardFunnelType

    /** Leads and revenue per channel, the most leads first. */
    @Field(() => [WorkspaceDashboardChannelType])
    channels!: Array<WorkspaceDashboardChannelType>

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
