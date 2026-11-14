import type { Type } from "@nestjs/common"
import type { DeskRightsRollup } from "./agent-desk.contracts"

/** What the app binds for the platform ports; the importer chooses global registration. */
export interface PlatformPortsOptions {
    /** The node-rights roll-up the desk's reach reads (`NodeRightRollupsService`); absent, the desk reaches nothing. */
    readonly rightsRollup?: Type<DeskRightsRollup>
}
