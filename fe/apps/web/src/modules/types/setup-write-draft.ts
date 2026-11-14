import type { FactScope } from "./brain"
import type { SetupResolution } from "./setup-write"

/** The values an owner can edit before deciding a setup proposal. */
export type SetupWriteDraft = {
    readonly isEditing: boolean
    readonly value: string
    readonly scope: FactScope
    readonly resolution: SetupResolution
    readonly situation: string
    /** Shared by every instance of the type unless the owner keeps it for this one. */
    readonly onlyThis: boolean
}
