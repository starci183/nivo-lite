import type { LeadActionStatus } from "@modules/domain/lead-actions"
import type { LeadActionStatusRequest } from "../../application/lead-action-status.contracts"
import type { LeadActionStatusInput } from "./dto/lead-action-status.input"
import type { LeadActionStatusType } from "./dto/lead-action-status.type"

/** Maps the selected workspace and action id into a status lookup. */
export const toLeadActionStatusRequest = (
    workspaceId: string,
    input: LeadActionStatusInput,
): LeadActionStatusRequest => ({ workspaceId, id: input.id })

/** Maps persisted progress and nullable nested results to the public status type. */
export const toLeadActionStatusType = (result: LeadActionStatus): LeadActionStatusType => ({ ...result })
