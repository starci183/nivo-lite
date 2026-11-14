import type { AccountDataTypeDef } from "@modules/domain/account-data"
import { renderDataTypeOf } from "@modules/domain/video-compose"
import { CREATOMATE_PROVIDER } from "./creatomate-failure.policy"

/** The account_data type Creatomate declares beside its capability: `creatomate.render` (append, key = the render id, wakes, 30 days). */
export const CREATOMATE_RENDER_DATA_TYPE: AccountDataTypeDef = renderDataTypeOf(CREATOMATE_PROVIDER)
