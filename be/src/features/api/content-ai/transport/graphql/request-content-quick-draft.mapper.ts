import type { ContentAiRequested } from "@modules/domain/content-ai"
import type { RequestContentQuickDraftRequest } from "../../application/request-content-quick-draft.contracts"
import type { RequestContentQuickDraftInput } from "./dto/request-content-quick-draft.input"
import type { ContentAiRequestedType } from "./dto/content-ai-requested.type"

/** Maps transport inputs and the selected workspace into an application request. */
export const toRequestContentQuickDraftRequest = (
    workspaceId: string,
    input: RequestContentQuickDraftInput,
): RequestContentQuickDraftRequest => ({ workspaceId, topic: input.topic, channels: input.channels })

/** A queued job with the item that the workbench may open immediately. */
export const toRequestContentQuickDraftType = (result: ContentAiRequested): ContentAiRequestedType => ({
    id: result.id,
    status: result.status,
    itemId: result.itemId,
})
