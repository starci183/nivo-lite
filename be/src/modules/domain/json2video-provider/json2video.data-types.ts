import type { AccountDataTypeDef } from "@modules/domain/account-data"
import { renderDataTypeOf } from "@modules/domain/video-compose"
import { JSON2VIDEO_PROVIDER } from "./json2video-failure.policy"

/**
 * The account_data types of a JSON2Video connection: one finished render per row (`json2video.render`, declared by the compose purpose's
 * factory: key = the provider's `project` id, terminal statuses only, wakes `render.completed`). JSON2Video's webhook body is not kept
 * raw: the body carries only the `client-data` NIVO never sets, plus technical members of the finished video.
 */
export const JSON2VIDEO_DATA_TYPES: ReadonlyArray<AccountDataTypeDef> = [renderDataTypeOf(JSON2VIDEO_PROVIDER)]
