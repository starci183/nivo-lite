import { Command } from "@nestjs/cqrs"
import type { ContentPublishedResult } from "@modules/domain/content-items"
import type { MarkContentPublishedRequest } from "@modules/domain/content-publishing"
import type { ExecuteParams } from "@modules/platform/cqrs"

/** Records a member's proof of posting an approved channel. */
export class MarkContentPublishedCommand extends Command<ContentPublishedResult> {
    constructor(readonly params: ExecuteParams<MarkContentPublishedRequest>) {
        super()
    }
}
