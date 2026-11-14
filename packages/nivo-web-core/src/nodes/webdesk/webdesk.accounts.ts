import { PROVIDER, type ProviderKey } from "@nivo-lite/agent-sdk/names"
import { CRM_NIVOWEB_PROVIDER } from "../../crm/nivoweb/api.generated"

/*
 * The providers of the Support agent's nodes, written once (CONVENTIONS "Names": one small accounts file per module). Each node
 * lists its own providers in order and declares ONE mode (`nivo-frame.rights`): NIVO Web is `auto` almost everywhere (a shop may set
 * `ask` on its own copy).
 */

/**
 * The messaging providers a Support node that answers a customer lists, in priority order: alternatives (the conversation's own
 * wins, C3).
 */
export const DESK_MESSAGING: readonly [ProviderKey, ProviderKey, ProviderKey] = [
    PROVIDER.zaloOa,
    PROVIDER.telegram,
    PROVIDER.meta,
]

/**
 * Every provider the Support agent works with, in the order the agent template attaches them (census sec.7, `openapi` read as
 * `crm`).
 */
export const WEBDESK_PROVIDERS: ReadonlyArray<ProviderKey> = [CRM_NIVOWEB_PROVIDER, ...DESK_MESSAGING, PROVIDER.smtp]
