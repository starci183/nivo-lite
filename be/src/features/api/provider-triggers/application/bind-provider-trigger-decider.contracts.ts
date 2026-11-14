import type { TriggerDeciderChange } from "@modules/domain/provider-triggers"

/** What bindProviderTriggerDecider takes. */
export interface BindProviderTriggerDeciderRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The binding to make or remove. */
    readonly change: TriggerDeciderChange
}
