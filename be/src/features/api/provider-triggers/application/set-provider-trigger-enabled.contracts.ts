import type { TriggerSwitchChange } from "@modules/domain/provider-triggers"

/** What setProviderTriggerEnabled takes. */
export interface SetProviderTriggerEnabledRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The switch to turn. */
    readonly change: TriggerSwitchChange
}
