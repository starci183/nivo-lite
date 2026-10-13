import type { QuotaLookup } from "@modules/domain/ai-usage-events"
import type { GetCreditQuotaStatusRequest } from "../../application/get-credit-quota-status.contracts"
import type { CreditQuotaStatusType } from "./dto/credit-quota-status.type"

/** Maps the workspace selector to the application request. */
export const toCreditQuotaStatusRequest = (workspaceId: string): GetCreditQuotaStatusRequest => ({ workspaceId })

/** Maps the quota to the nullable GraphQL type. */
export const toCreditQuotaStatusType = (result: QuotaLookup): CreditQuotaStatusType | null => result
