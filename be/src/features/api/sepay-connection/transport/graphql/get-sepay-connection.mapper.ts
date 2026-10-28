import type { SepayConnectionView } from "@modules/domain/channel-connections"
import type { GetSepayConnectionRequest } from "../../application/get-sepay-connection.contracts"
import type { GetSepayConnectionInput } from "./dto/get-sepay-connection.input"
import type { SepayConnectionType } from "./dto/sepay-connection.type"

/** Maps the GraphQL arguments of sepayConnection to the request. */
export const toGetSepayConnectionRequest = (
    workspaceId: string,
    input: GetSepayConnectionInput,
): GetSepayConnectionRequest => ({ workspaceId, connectionId: input.connectionId })

/** Maps the answer of sepayConnection to the GraphQL type. */
export const toSepayConnectionType = (result: SepayConnectionView): SepayConnectionType => result
