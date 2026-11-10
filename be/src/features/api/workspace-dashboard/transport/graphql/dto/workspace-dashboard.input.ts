import { Field, InputType } from "@nestjs/graphql"
import { IsEnum, MaxLength } from "class-validator"
import type { DashboardPeriod } from "@modules/domain/workspace-dashboard"
import { WorkspaceDashboardPeriod } from "./workspace-dashboard-period.type"

@InputType()
/** The period of the owner dashboard. */
export class WorkspaceDashboardInput {
    /** Today, the last seven or thirty days, or this month; the figures are compared with the period before it of the same length. */
    @Field(() => WorkspaceDashboardPeriod)
    @IsEnum(WorkspaceDashboardPeriod)
    @MaxLength(20)
    period!: DashboardPeriod
}
