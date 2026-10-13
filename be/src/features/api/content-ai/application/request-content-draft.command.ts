import { Command } from "@nestjs/cqrs"
import type { ContentAiRequested } from "@modules/domain/content-ai"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RequestContentDraftRequest } from "./request-content-draft.contracts"

/** Enqueues the requested content operation. */
export class RequestContentDraftCommand extends Command<ContentAiRequested> {
    constructor(readonly params: ExecuteParams<RequestContentDraftRequest>) {
        super()
    }
}
