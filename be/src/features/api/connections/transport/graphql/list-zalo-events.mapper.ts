import type { ListZaloEventsRequest } from "../../application/list-zalo-events.contracts"
import type { ZaloPageEvent } from "@modules/domain/channels"
import type { ListZaloEventsInput } from "./dto/list-zalo-events.input"
import type { ZaloEventType } from "./dto/zalo-event.type"

/** Maps the GraphQL arguments of zaloConnectionEvents to the request. */
export const toListZaloEventsRequest = (workspaceId: string, input: ListZaloEventsInput): ListZaloEventsRequest => ({
    workspaceId,
    connectionId: input.connectionId,
})

/** Maps the answer of zaloConnectionEvents to the GraphQL type. */
export const toListZaloEventsType = (result: ReadonlyArray<ZaloPageEvent>): Array<ZaloEventType> => [...result]
