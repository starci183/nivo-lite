import type { RecheckZaloConnectionRequest } from "../../application/recheck-zalo-connection.contracts"
import type { ZaloPageView } from "@modules/domain/channels"
import type { RecheckZaloConnectionInput } from "./dto/recheck-zalo-connection.input"
import type { ZaloPageType } from "./dto/zalo-page.type"

/** Maps the GraphQL arguments of recheckZaloConnection to the request. */
export const toRecheckZaloConnectionRequest = (
    workspaceId: string,
    input: RecheckZaloConnectionInput,
): RecheckZaloConnectionRequest => ({
    workspaceId,
    connectionId: input.connectionId,
})

/** Maps the answer of recheckZaloConnection to the GraphQL type. */
export const toRecheckZaloConnectionType = (result: ZaloPageView): ZaloPageType => result
