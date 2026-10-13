import { useLocale } from "next-intl"
import { MODULE_KEYS, MODULE_REGISTRY, pickCopy } from "@/modules/catalog"
import { AGENT_STATUS_TONE, agentHref, agentStatusOf } from "@/modules/installations"
import { useInstallations } from "./useInstallations"

/** The installed agents (one row per instance) for the switcher of the agent frame; the catalogue, not installed, until they are known. */
export const useInstanceRail = (installationId: string) => {
    const locale = useLocale() === "en" ? "en" : "vi"
    const { installations } = useInstallations()
    if (installations === undefined) {
        return {
            isLoading: true,
            items: MODULE_KEYS.map((key) => ({
                id: key,
                href: agentHref(key, null),
                name: pickCopy(MODULE_REGISTRY[key].name, locale),
                mascot: MODULE_REGISTRY[key].mascot,
                isCurrent: false,
                status: agentStatusOf(undefined),
                statusTone: AGENT_STATUS_TONE.notInstalled,
            })),
        }
    }
    return {
        isLoading: false,
        items: installations.map((other) => {
            const status = agentStatusOf(other)
            return {
                id: other.id,
                href: agentHref(other.moduleKey, other.id),
                name: other.isMulti ? other.name : pickCopy(MODULE_REGISTRY[other.moduleKey].name, locale),
                mascot: MODULE_REGISTRY[other.moduleKey].mascot,
                isCurrent: other.id === installationId,
                status,
                statusTone: AGENT_STATUS_TONE[status],
            }
        }),
    }
}
