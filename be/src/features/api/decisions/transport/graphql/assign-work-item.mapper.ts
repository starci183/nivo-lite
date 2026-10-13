import type { WorkItem } from "@modules/domain/decisions"
import type { AssignWorkItemRequest } from "../../application/assign-work-item.contracts"
import type { AssignWorkItemArgs } from "./dto/assign-work-item.args"
import type { WorkItemType } from "./dto/work-item.type"

/** Maps the assignment arguments, with the workspace they name, to the command request. */
export const toAssignWorkItemRequest = (workspaceId: string, args: AssignWorkItemArgs): AssignWorkItemRequest => ({
    workspaceId,
    workItemId: args.workItemId,
    staffId: args.staffId,
})

/** Maps the assigned work item to the GraphQL type. */
export const toAssignedWorkItemType = (item: WorkItem): WorkItemType => ({ ...item })
