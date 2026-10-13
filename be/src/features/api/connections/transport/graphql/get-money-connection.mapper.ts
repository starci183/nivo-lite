import type { GetMoneyConnectionRequest } from "../../application/get-money-connection.contracts"
import type { WizardConnection } from "@modules/domain/channel-connections"
import type { GetMoneyConnectionInput } from "./dto/get-money-connection.input"
import type { WizardConnectionType } from "./dto/wizard-connection.type"

/** Maps the GraphQL arguments of moneyConnection to the request. */
export const toGetMoneyConnectionRequest = (
    workspaceId: string,
    input: GetMoneyConnectionInput,
): GetMoneyConnectionRequest => ({
    workspaceId,
    connectionId: input.connectionId,
})

/** Maps the answer of moneyConnection to the GraphQL type. */
export const toGetMoneyConnectionType = (result: WizardConnection): WizardConnectionType => result
