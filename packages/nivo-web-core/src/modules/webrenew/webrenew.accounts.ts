import { PROVIDER, type ProviderKey } from "@nivo-lite/agent-sdk/names"
import { CRM_NIVOWEB_PROVIDER } from "../../crm/nivoweb/api.generated"

/*
 * The providers of the Renewal steps, written once. Each node lists its own providers in order and declares ONE mode
 * (`nivo-frame.rights`): NIVO Web is `auto` almost everywhere (a shop may set `ask` on its own copy).
 */

/** The messaging providers, in priority order: alternatives. A reply still goes through the conversation's own account (C3). */
export const WEBRENEW_MESSAGING: readonly [ProviderKey, ProviderKey, ProviderKey] = [
    PROVIDER.zaloOa,
    PROVIDER.telegram,
    PROVIDER.meta,
]

/** The providers the Renewal agent works with, in priority order (census §7, the CRM's source key `crm` for `openapi`). */
export const WEBRENEW_PROVIDERS: ReadonlyArray<ProviderKey> = [CRM_NIVOWEB_PROVIDER, ...WEBRENEW_MESSAGING, PROVIDER.smtp]
