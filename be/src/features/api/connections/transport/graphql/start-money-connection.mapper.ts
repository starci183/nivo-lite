import type { StartMoneyConnectionRequest } from "../../application/start-money-connection.contracts"
import type { WizardConnection } from "@modules/domain/channel-connections"
import type { StartMoneyConnectionInput } from "./dto/start-money-connection.input"
import { toWizardConnectionType } from "./wizard-connection.mapper"
import type { WizardConnectionType } from "./dto/wizard-connection.type"

/** Maps the GraphQL arguments of startMoneyConnection to the request. */
export const toStartMoneyConnectionRequest = (
    workspaceId: string,
    input: StartMoneyConnectionInput,
): StartMoneyConnectionRequest => ({
    workspaceId,
    provider: input.provider,
    environment: input.environment,
    name: input.name,
    bankCode: input.bankCode,
    accountNumber: input.accountNumber,
    holder: input.holder,
})

/** Maps the answer of startMoneyConnection to the GraphQL type. */
export const toStartMoneyConnectionType = (result: WizardConnection): WizardConnectionType =>
    toWizardConnectionType(result)
