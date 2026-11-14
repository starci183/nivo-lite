import type { ProviderKey } from "@nivo-lite/agent-sdk/names"
import { CRM_NIVOWEB_PROVIDER } from "../../crm/nivoweb/api.generated"

/** Every provider the Paperwork agent works with (census §7, `openapi` read as the CRM's source key `crm`). */
export const WEBDOCS_PROVIDERS: ReadonlyArray<ProviderKey> = [CRM_NIVOWEB_PROVIDER]
