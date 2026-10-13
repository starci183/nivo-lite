import { WorkItemResponse } from "./work-item.response"

/** The position after which the next page starts. */
export class WorkItemCursorResponse {
    /** The `created_at` of the last item of the page. */
    createdAt!: string
    /** The id of the last item of the page. */
    id!: string
}

/** One page of work items, newest first. */
export class WorkItemPageResponse {
    /** The items of the page. */
    items!: ReadonlyArray<WorkItemResponse>
    /** The cursor of the next page; null on the last one. */
    next!: WorkItemCursorResponse | null
}
