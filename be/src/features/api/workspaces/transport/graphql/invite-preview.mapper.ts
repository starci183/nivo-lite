import type { InvitePreview } from "@modules/domain/workspace-invites"
import type { PreviewInviteRequest } from "../../application/preview-invite.contracts"
import type { InvitePreviewType } from "./dto/invite-preview.type"
import type { InviteTokenInput } from "./dto/invite-token.input"

/** Maps the GraphQL input to the query request. */
export const toPreviewInviteRequest = (input: InviteTokenInput): PreviewInviteRequest => ({ token: input.token })

/** Maps the invitation preview to the GraphQL type. */
export const toInvitePreviewType = (result: InvitePreview): InvitePreviewType => ({
    workspaceName: result.workspaceName,
    email: result.email,
    role: result.role,
    staffName: result.staffName,
    state: result.state,
})
