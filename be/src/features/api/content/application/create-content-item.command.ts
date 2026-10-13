import { Command } from "@nestjs/cqrs"
import type { ContentItem } from "@modules/domain/content-items"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { CreateContentItemRequest } from "./create-content-item.contracts"

/** Asks the content capability to create a post. */
export class CreateContentItemCommand extends Command<ContentItem> {
    constructor(readonly params: ExecuteParams<CreateContentItemRequest>) {
        super()
    }
}
