import type { ContentAiRequested } from "@modules/domain/content-ai"
import type { RequestContentDraftRequest } from "../../application/request-content-draft.contracts"
import type { RequestContentDraftInput } from "./dto/request-content-draft.input"
import type { ContentAiRequestedType } from "./dto/content-ai-requested.type"

/** Maps transport inputs and the selected workspace into an application request. */
export const toRequestContentDraftRequest = (
    workspaceId: string,
    input: RequestContentDraftInput,
): RequestContentDraftRequest => ({ workspaceId, id: input.id, hint: input.hint })

/** A queued job with the item that the workbench may open immediately. */
export const toRequestContentDraftType = (result: ContentAiRequested): ContentAiRequestedType => ({
    id: result.id,
    status: result.status,
    itemId: result.itemId,
})
