import type { SaveZnsRenewalRequest } from "../../application/save-zns-renewal.contracts"
import type { OptionalZnsRenewal } from "@modules/domain/channels"
import type { SaveZnsRenewalInput } from "./dto/save-zns-renewal.input"
import type { ZnsRenewalType } from "./dto/zns-renewal.type"

/** Maps the GraphQL arguments of saveZnsRenewal to the request. */
export const toSaveZnsRenewalRequest = (workspaceId: string, input: SaveZnsRenewalInput): SaveZnsRenewalRequest => ({
    workspaceId,
    connectionId: input.connectionId,
    settings: {
        templateId: input.templateId,
        params: {
            customerName: input.customerName,
            plan: input.plan,
            endDate: input.endDate,
            amount: input.amount,
            transferContent: input.transferContent,
            invoiceNumber: input.invoiceNumber,
        },
    },
})

/** Maps the answer of saveZnsRenewal to the GraphQL type; null when the fallback is off. */
export const toSaveZnsRenewalType = (result: OptionalZnsRenewal): ZnsRenewalType | null => result
