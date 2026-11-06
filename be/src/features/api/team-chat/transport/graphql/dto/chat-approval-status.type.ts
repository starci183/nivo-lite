import { registerEnumType } from "@nestjs/graphql"

/** Where the decision of an approval card stands. */
export const ChatApprovalStatus = { pending: "pending", approved: "approved", refused: "refused", expired: "expired" }

registerEnumType(ChatApprovalStatus, { name: "ChatApprovalStatus" })
