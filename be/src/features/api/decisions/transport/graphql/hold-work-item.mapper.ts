import type { WorkItem } from "@modules/domain/decisions"
import type { HoldWorkItemRequest } from "../../application/hold-work-item.contracts"
import type { HoldWorkItemArgs } from "./dto/hold-work-item.args"
import type { WorkItemType } from "./dto/work-item.type"

/** Maps the hold arguments, with the workspace they name, to the command request. */
export const toHoldWorkItemRequest = (workspaceId: string, args: HoldWorkItemArgs): HoldWorkItemRequest => ({
    workspaceId,
    workItemId: args.workItemId,
    note: args.note,
})

/** Maps the held work item to the GraphQL type. */
export const toHeldWorkItemType = (item: WorkItem): WorkItemType => ({ ...item })
