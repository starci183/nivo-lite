import type { GetZaloPageRequest } from "../../application/get-zalo-page.contracts"
import type { ZaloPageView } from "@modules/domain/channels"
import type { GetZaloPageInput } from "./dto/get-zalo-page.input"
import type { ZaloPageType } from "./dto/zalo-page.type"

/** Maps the GraphQL arguments of zaloConnectionPage to the request. */
export const toGetZaloPageRequest = (workspaceId: string, input: GetZaloPageInput): GetZaloPageRequest => ({
    workspaceId,
    connectionId: input.connectionId,
})

/** Maps the answer of zaloConnectionPage to the GraphQL type. */
export const toGetZaloPageType = (result: ZaloPageView): ZaloPageType => result
