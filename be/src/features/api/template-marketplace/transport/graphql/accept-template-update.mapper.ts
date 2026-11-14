import type { AcceptTemplateUpdateRequest } from "../../application/accept-template-update.contracts"
import type { UpdateOffer } from "@nivo-lite/agent-sdk/template"
import type { AcceptTemplateUpdateInput } from "./dto/accept-template-update.input"
import type { UpdateOfferType } from "./dto/update-offer.type"

/** Maps the GraphQL arguments of acceptTemplateUpdate to the request. */
export const toAcceptTemplateUpdateRequest = (
    workspaceId: string,
    input: AcceptTemplateUpdateInput,
): AcceptTemplateUpdateRequest => ({
    workspaceId,
    installationId: input.installationId,
    unitIds: input.unitIds,
    agreedRights: input.agreedRights,
})

/** Maps the answer to the GraphQL type. */
export const toAcceptTemplateUpdateType = (result: UpdateOffer | null): UpdateOfferType | null => result
