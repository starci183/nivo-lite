"use client"

import { useLocale, useTranslations } from "next-intl"
import { useModuleCatalog } from "@/hooks/moduleCatalog"
import { MODULE_REGISTRY, pickCopy } from "@/modules/catalog"
import type { ModuleKey } from "@/modules/catalog"
import { agentLifecycleOf, agentLifecycleTone, agentSubtitleOf, installationPersonName } from "@/modules/installations"
import { agentChatHref, agentProfileHref } from "@/modules/routes"
import { useInstanceChannels } from "./useInstanceChannels"
import { useInstanceGuard } from "./useInstanceGuard"
import { useInstallations } from "./useInstallations"

/**
 * The header of one agent instance: the person (name, handle, avatar seed), the role, the lifecycle and the channels; skeleton
 * data until the instance is known. If the installed agents cannot be read the header stops waiting and names the role.
 */
export const useInstanceHeader = (module: ModuleKey, installationId: string) => {
    const t = useTranslations("modulesCore")
    const locale = useLocale() === "en" ? "en" : "vi"
    const guard = useInstanceGuard(module, installationId)
    const isFailed = useInstallations().slot.isError === true
    const installation = guard.installation
    const def = MODULE_REGISTRY[module]
    const catalog = useModuleCatalog()
    const copy = catalog.modules[module]
    const channelsOf = useInstanceChannels()
    const fallbackName = catalog.slot.isError === true ? module : ""
    const lifecycle = agentLifecycleOf(installation)
    const channels = channelsOf(installation?.agentId ?? null)
    const typeName = copy === undefined ? fallbackName : pickCopy(copy.name, locale)
    const unknownName = isFailed ? typeName : ""
    return {
        isLoading: (installation === undefined && !isFailed) || catalog.slot.isLoading === true,
        name: installation === undefined ? unknownName : installationPersonName(installation),
        handle: installation?.agentHandle ?? "",
        seed: installation?.agentId ?? installation?.id ?? "",
        avatarUrl: installation?.agentAvatarUrl ?? null,
        typeName,
        subtitle: agentSubtitleOf({
            handle: installation?.agentHandle ?? "",
            roleName: typeName,
            channels: channels.length === 0 ? [t("headerNoChannels")] : channels,
        }),
        isEarly: def.status === "early",
        lifecycle,
        statusTone: agentLifecycleTone(lifecycle),
        channels,
        connectionNeeds: installation?.connectionNeeds ?? [],
        chatHref: installation?.agentId == null ? null : agentChatHref(installation.agentId),
        profileHref: installation?.agentId == null ? null : agentProfileHref(installation.agentId),
    }
}
