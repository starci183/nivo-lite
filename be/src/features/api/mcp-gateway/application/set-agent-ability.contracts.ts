import type { AbilityInput } from "@modules/domain/mcp-gateway"

/** What setAgentAbility takes. */
export interface SetAgentAbilityRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The agent, the provider, the ability and its mode. */
    readonly ability: AbilityInput
}
