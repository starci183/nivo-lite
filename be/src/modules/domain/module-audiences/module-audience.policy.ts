import { INSTALLED } from "@modules/domain/installed-plugins"
import type { OptionalModuleAudience } from "./module-audiences.contracts"

/** The audience of the module with this key, as its installed template declares it, or null when no installed module has that key. */
export function catalogAudienceOf(moduleKey: string): OptionalModuleAudience {
    return INSTALLED.servers().find((server) => server.key === moduleKey)?.template.audience ?? null
}
