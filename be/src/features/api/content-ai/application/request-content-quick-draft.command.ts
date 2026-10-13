import { Command } from "@nestjs/cqrs"
import type { ContentAiRequested } from "@modules/domain/content-ai"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RequestContentQuickDraftRequest } from "./request-content-quick-draft.contracts"

/** Enqueues the requested content operation. */
export class RequestContentQuickDraftCommand extends Command<ContentAiRequested> {
    constructor(readonly params: ExecuteParams<RequestContentQuickDraftRequest>) {
        super()
    }
}
