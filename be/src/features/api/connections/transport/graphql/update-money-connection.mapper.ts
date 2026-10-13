import type { UpdateMoneyConnectionRequest } from "../../application/update-money-connection.contracts"
import type { WizardConnection } from "@modules/domain/channel-connections"
import type { UpdateMoneyConnectionInput } from "./dto/update-money-connection.input"
import { toWizardConnectionType } from "./wizard-connection.mapper"
import type { WizardConnectionType } from "./dto/wizard-connection.type"

/** Maps the GraphQL arguments of updateMoneyConnection to the request. */
export const toUpdateMoneyConnectionRequest = (
    workspaceId: string,
    input: UpdateMoneyConnectionInput,
): UpdateMoneyConnectionRequest => ({
    workspaceId,
    connectionId: input.connectionId,
    environment: input.environment,
    name: input.name,
    bankCode: input.bankCode,
    accountNumber: input.accountNumber,
    holder: input.holder,
    apiKey: input.apiKey,
})

/** Maps the answer of updateMoneyConnection to the GraphQL type. */
export const toUpdateMoneyConnectionType = (result: WizardConnection): WizardConnectionType =>
    toWizardConnectionType(result)
