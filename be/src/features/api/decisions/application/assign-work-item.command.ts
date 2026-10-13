import { Command } from "@nestjs/cqrs"
import type { WorkItem } from "@modules/domain/decisions"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AssignWorkItemRequest } from "./assign-work-item.contracts"

/** Asks to give a work item to a staff member, or to take it back. */
export class AssignWorkItemCommand extends Command<WorkItem> {
    constructor(readonly params: ExecuteParams<AssignWorkItemRequest>) {
        super()
    }
}
