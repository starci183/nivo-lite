import type { ConnectionFieldsView } from "@modules/domain/connection-fields"
import type { GetConnectionFieldsRequest } from "../../application/get-connection-fields.contracts"
import type { GetConnectionFieldsInput } from "./dto/get-connection-fields.input"
import type { ConnectionFieldsType } from "./dto/get-connection-fields.type"

/** Maps the GraphQL arguments of connectionFields to the request. */
export const toGetConnectionFieldsRequest = (workspaceId: string, input: GetConnectionFieldsInput): GetConnectionFieldsRequest => ({
    workspaceId,
    connectionId: input.connectionId,
})

/** Maps the connection form to its GraphQL type: the capability already answers in its shape. */
export const toConnectionFieldsType = (view: ConnectionFieldsView): ConnectionFieldsType => view
