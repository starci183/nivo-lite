import { Command } from "@nestjs/cqrs"
import type { WorkItem } from "@modules/domain/decisions"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DecideWorkItemRequest } from "./decide-work-item.contracts"

/** Asks to approve (optionally edited) or reject a waiting work item. */
export class DecideWorkItemCommand extends Command<WorkItem> {
    constructor(readonly params: ExecuteParams<DecideWorkItemRequest>) {
        super()
    }
}
