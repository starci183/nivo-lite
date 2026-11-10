import { Field, Int, ObjectType } from "@nestjs/graphql"
import { WorkspaceDashboardApprovalType } from "./workspace-dashboard-approval.type"

@ObjectType()
/** The items that wait for the owner: how many wait and the oldest few. */
export class WorkspaceDashboardApprovalsType {
    /** Every item that waits. */
    @Field(() => Int)
    total!: number

    /** The oldest items, at most six. */
    @Field(() => [WorkspaceDashboardApprovalType])
    items!: Array<WorkspaceDashboardApprovalType>
}
