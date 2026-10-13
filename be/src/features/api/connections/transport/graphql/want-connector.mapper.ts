import type { WantConnectorRequest } from "../../application/want-connector.contracts"
import type { WantConnectorInput } from "./dto/want-connector.input"

/** Maps the GraphQL arguments of wantConnector to the request. */
export const toWantConnectorRequest = (workspaceId: string, input: WantConnectorInput): WantConnectorRequest => ({
    workspaceId,
    connectorId: input.connectorId,
})
