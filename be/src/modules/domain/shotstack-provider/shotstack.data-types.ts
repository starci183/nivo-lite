import type { AccountDataTypeDef } from "@modules/domain/account-data"
import { renderDataTypeOf } from "@modules/domain/video-compose"
import { SHOTSTACK_PROVIDER } from "./shotstack-failure.policy"

/**
 * The account data types Shotstack declares: one finished render per render id (`shotstack.render`: append, keyed by `renderId`, wakes
 * `render.completed`, 30 days). Only a terminal callback is a row; the callback body is mapped by `shotstackCompletionOf`.
 */
export const SHOTSTACK_DATA_TYPES: ReadonlyArray<AccountDataTypeDef> = [renderDataTypeOf(SHOTSTACK_PROVIDER)]
