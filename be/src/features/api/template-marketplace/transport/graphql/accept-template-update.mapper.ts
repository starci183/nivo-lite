import type { AcceptTemplateUpdateRequest } from "../../application/accept-template-update.contracts"
import type { UpdateOffer } from "@modules/domain/agent-templates"
import type { AcceptTemplateUpdateInput } from "./dto/accept-template-update.input"
import type { UpdateOfferType } from "./dto/update-offer.type"
import { toUpdateOfferType } from "./template-marketplace.records.mapper"

/** Maps the GraphQL arguments of acceptTemplateUpdate to the request. */
export const toAcceptTemplateUpdateRequest = (
    workspaceId: string,
    input: AcceptTemplateUpdateInput,
): AcceptTemplateUpdateRequest => ({ workspaceId, installationId: input.installationId, unitIds: input.unitIds })

/** Maps the answer to the GraphQL type. */
export const toAcceptTemplateUpdateType = (result: UpdateOffer | null): UpdateOfferType | null =>
    result === null ? null : toUpdateOfferType(result)
