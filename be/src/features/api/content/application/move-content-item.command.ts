import { Command } from "@nestjs/cqrs"
import type { ContentItem } from "@modules/domain/content-items"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { MoveContentItemRequest } from "./move-content-item.contracts"

/** Asks the content capability to move a post. */
export class MoveContentItemCommand extends Command<ContentItem> {
    constructor(readonly params: ExecuteParams<MoveContentItemRequest>) {
        super()
    }
}
