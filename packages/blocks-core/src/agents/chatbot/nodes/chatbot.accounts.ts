import { PROVIDER, type ProviderKey } from "@nivo-lite/agent-sdk/names"

/**
 * The messaging providers of the Chatbot, in priority order: alternatives. A reply still goes through the conversation's own account
 * (the data owner, contract C3); the list says which providers the node may answer through at all. Its mode is the node's (one per node,
 * `nivo-frame.rights`); a graph of another agent sets its step's mode itself (the Webdesk front desk asks before each send).
 */
export const CHATBOT_MESSAGING: readonly [ProviderKey, ProviderKey, ProviderKey] = [
    PROVIDER.zaloOa,
    PROVIDER.telegram,
    PROVIDER.meta,
]
