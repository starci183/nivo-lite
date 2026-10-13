import { useLocale } from "next-intl"
import { MODULE_REGISTRY, pickCopy } from "@/modules/catalog"
import type { ModuleKey } from "@/modules/catalog"
import { AGENT_STATUS_TONE, agentListHref, agentStatusOf } from "@/modules/installations"
import { useInstanceGuard } from "./useInstanceGuard"

/** The header of one agent instance: type, instance name, status, version and live state; skeleton data until the instance is known. */
export const useInstanceHeader = (module: ModuleKey, installationId: string) => {
    const locale = useLocale() === "en" ? "en" : "vi"
    const guard = useInstanceGuard(module, installationId)
    const installation = guard.installation
    const def = MODULE_REGISTRY[module]
    const status = agentStatusOf(installation)
    const multiName = installation?.isMulti === true ? installation.name : null
    return {
        isLoading: installation === undefined,
        typeName: pickCopy(def.name, locale),
        mascot: def.mascot,
        isEarly: def.status === "early",
        multiName,
        listHref: multiName === null ? null : agentListHref(module),
        status,
        statusTone: AGENT_STATUS_TONE[status],
        activeVersion: installation?.activeVersion ?? null,
        isLive: installation?.liveEnabled === true,
    }
}
