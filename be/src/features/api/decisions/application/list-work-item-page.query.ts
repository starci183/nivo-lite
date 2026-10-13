import { Query } from "@nestjs/cqrs"
import type { WorkItemPage } from "@modules/domain/decisions"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListWorkItemPageRequest } from "./list-work-item-page.contracts"

/** Asks for one page of the workspace's work items, newest first. */
export class ListWorkItemPageQuery extends Query<WorkItemPage> {
    constructor(readonly params: ExecuteParams<ListWorkItemPageRequest>) {
        super()
    }
}
