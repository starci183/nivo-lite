import { Query } from "@nestjs/cqrs"
import type { WorkItem } from "@modules/domain/decisions"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetWorkItemRequest } from "./get-work-item.contracts"

/** Asks for one work item of the workspace. */
export class GetWorkItemQuery extends Query<WorkItem> {
    constructor(readonly params: ExecuteParams<GetWorkItemRequest>) {
        super()
    }
}
