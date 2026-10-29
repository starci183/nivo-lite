import { ApprovalRequestEntity } from "./approval-request.entity"

export { ApprovalRequestEntity }

/** Every entity the approval-requests capability owns, collected by the database connection. */
export const approvalRequestsEntities = [ApprovalRequestEntity] as const
