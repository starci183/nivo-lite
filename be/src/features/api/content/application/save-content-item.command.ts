import { Command } from "@nestjs/cqrs"
import type { ContentItem } from "@modules/domain/content-items"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveContentItemRequest } from "./save-content-item.contracts"

/** Asks the content capability to save a post. */
export class SaveContentItemCommand extends Command<ContentItem> {
    constructor(readonly params: ExecuteParams<SaveContentItemRequest>) {
        super()
    }
}
