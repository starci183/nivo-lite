"use client"

import { useLocale, useTranslations } from "next-intl"
import { useModuleCatalog } from "@/hooks/moduleCatalog"
import { loadingSlot, slotOfReads } from "@/hooks/slot"
import { useWorkspaceId } from "@/hooks/workspaces"
import { MODULE_REGISTRY, pickCopy } from "@/modules/catalog"
import type { ModuleKey } from "@/modules/catalog"
import {
    agentLifecycleOf,
    agentLifecycleTone,
    agentSubtitleOf,
    installationPersonName,
    type AgentLifecycle,
    type InstallationConnectionNeed,
} from "@/modules/installations"
import { agentProfileHref, workspaceHref } from "@/modules/routes"
import { useInstanceCounts } from "./useInstanceCounts"
import type { InstanceCounts } from "./useInstanceCounts"
import { useInstanceGuard } from "./useInstanceGuard"
import { useInstallations } from "./useInstallations"
import type { DataSlot } from "@/modules/types"

/** The accounts the header names: none while they load, a soft "none yet" once the read says there are none. */
const namesOf = (names: ReadonlyArray<string> | undefined, none: string): ReadonlyArray<string> => {
    if (names === undefined) return []
    return names.length === 0 ? [none] : names
}

/** The view `useInstanceHeader` returns. */
export interface InstanceHeaderViewShape {
    retry: () => void
    slot: DataSlot<{
        name: string
        handle: string
        seed: string
        avatarUrl: string | null
        typeName: string
        subtitle: string
        isEarly: boolean
        lifecycle: AgentLifecycle
        statusTone: "success" | "neutral" | "warning" | "accent"
        counts: InstanceCounts
        connectionNeeds: readonly InstallationConnectionNeed[]
        profileHref: string | null
    }>
    name: string
    handle: string
    seed: string
    avatarUrl: string | null
    typeName: string
    subtitle: string
    isEarly: boolean
    lifecycle: AgentLifecycle
    statusTone: "success" | "neutral" | "warning" | "accent"
    counts: InstanceCounts
    connectionNeeds: readonly InstallationConnectionNeed[]
    profileHref: string | null
}

/**
 * The header of one agent instance: the person (name, handle), the role, the lifecycle, the accounts it was granted and the counts of the tabs; skeleton
 * data until the instance is known. If the installed agents cannot be read the header stops waiting and names the role.
 */
export const useInstanceHeader = (module: ModuleKey, installationId: string): InstanceHeaderViewShape => {
    const t = useTranslations("modulesCore")
    const locale = useLocale() === "en" ? "en" : "vi"
    const guard = useInstanceGuard(module, installationId)
    const workspaceId = useWorkspaceId()
    const { read } = useInstallations()
    const isFailed = read.data === undefined && read.error !== undefined
    const installation = guard.installation
    const def = MODULE_REGISTRY[module]
    const catalog = useModuleCatalog()
    const copy = catalog.modules[module]
    const counts = useInstanceCounts(installation?.agentId ?? null)
    const fallbackName = catalog.read.data === undefined && catalog.read.error !== undefined ? module : ""
    const lifecycle = agentLifecycleOf(installation)
    const typeName = copy === undefined ? fallbackName : pickCopy(copy.name, locale)
    const unknownName = isFailed ? typeName : ""
    const view = {
        name: installation === undefined ? unknownName : installationPersonName(installation),
        handle: installation?.agentHandle ?? "",
        seed: installation?.agentId ?? installation?.id ?? "",
        avatarUrl: installation?.agentAvatarUrl ?? null,
        typeName,
        subtitle: agentSubtitleOf({
            handle: installation?.agentHandle ?? "",
            roleName: typeName,
            channels: namesOf(counts.grantedNames, t("headerNoGrants")),
        }),
        isEarly: def.status === "early",
        lifecycle,
        statusTone: agentLifecycleTone(lifecycle),
        counts,
        connectionNeeds: installation?.connectionNeeds ?? [],
        profileHref:
            installation?.agentId == null ? null : workspaceHref(workspaceId, agentProfileHref(installation.agentId)),
    }
    return {
        ...view,
        retry: () => {
            void read.mutate()
            catalog.reload()
        },
        slot: guard.isLeaving ? loadingSlot<typeof view>() : slotOfReads([read, catalog.read], () => view),
    }
}
