import { PROVIDER, type ProviderKey } from "@nivo-lite/agent-sdk/names"

/**
 * Every provider the Sales nodes of this slice list, in the order the agent template attaches them: the messaging providers a node that
 * talks to the customer lists (the reply itself goes through the conversation's own account, contract C3). Each node lists its own
 * providers and declares its mode (`nivo-frame.rights`).
 */
export const SALES_CONSULT_PROVIDERS: ReadonlyArray<ProviderKey> = [PROVIDER.zaloOa, PROVIDER.telegram, PROVIDER.meta]
