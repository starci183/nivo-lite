"use client"

import { useLocale } from "next-intl"
import { useModuleCatalog } from "@/hooks/moduleCatalog"
import { slotOfReads } from "@/hooks/slot"
import { pickCopy } from "@/modules/catalog"
import { installationPersonName, agentHref, agentLifecycleOf, agentLifecycleTone } from "@/modules/installations"
import { useInstallations } from "./useInstallations"

/** The installed agents (one row per instance, as people of the team) for the switcher of the agent frame; no rows until they are known. */
export const useInstanceRail = (installationId: string) => {
    const locale = useLocale() === "en" ? "en" : "vi"
    const installed = useInstallations()
    const catalog = useModuleCatalog()
    const items = (installed.installations ?? []).map((other) => {
        const lifecycle = agentLifecycleOf(other)
        const copy = catalog.modules[other.moduleKey]
        return {
            id: other.id,
            href: agentHref(other.moduleKey, other.id),
            name: installationPersonName(other),
            seed: other.agentId ?? other.id,
            avatarUrl: other.agentAvatarUrl,
            roleName: copy === undefined ? "" : pickCopy(copy.name, locale),
            isCurrent: other.id === installationId,
            lifecycle,
            statusTone: agentLifecycleTone(lifecycle),
        }
    })
    return { items, slot: slotOfReads([installed.read, catalog.read], () => items) }
}
