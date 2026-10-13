import { Command } from "@nestjs/cqrs"
import type { WorkItem } from "@modules/domain/decisions"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { HoldWorkItemRequest } from "./hold-work-item.contracts"

/** Asks to keep a waiting work item waiting, with a note. */
export class HoldWorkItemCommand extends Command<WorkItem> {
    constructor(readonly params: ExecuteParams<HoldWorkItemRequest>) {
        super()
    }
}
