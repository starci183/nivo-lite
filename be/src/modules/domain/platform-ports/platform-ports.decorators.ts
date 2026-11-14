import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { DeskRightsRollup } from "./agent-desk.contracts"

/** Token of the node-rights roll-up the desk's reach reads, which the app binds (the node-right-rollups capability). */
export const DESK_RIGHTS_ROLLUP: unique symbol = Symbol("domain.platform-ports.desk-rights-rollup")

/** Injects the node-rights roll-up the app bound. Parameter type: DeskRightsRollup. */
export const InjectDeskRightsRollup = (): TypedParameterDecorator<DeskRightsRollup> =>
    injector<DeskRightsRollup>(DESK_RIGHTS_ROLLUP)
