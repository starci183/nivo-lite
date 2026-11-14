import { PROVIDER, type ProviderKey } from "@nivo-lite/agent-sdk/names"
import { CRM_NIVOWEB_PROVIDER } from "../../crm/nivoweb/api.generated"

/** The providers the Sales agent template works with, in the order they are attached (census §7: CRM, MSG, smtp). */
export const WEBSALES_PROVIDERS: ReadonlyArray<ProviderKey> = [
    CRM_NIVOWEB_PROVIDER,
    PROVIDER.zaloOa,
    PROVIDER.telegram,
    PROVIDER.meta,
    PROVIDER.smtp,
]
