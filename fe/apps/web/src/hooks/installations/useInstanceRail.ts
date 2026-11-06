"use client"

import { useLocale } from "next-intl"
import { useModuleCatalog } from "@/hooks/moduleCatalog"
import { slotOfReads } from "@/hooks/slot"
import { useWorkspaceId } from "@/hooks/workspaces"
import { pickCopy } from "@/modules/catalog"
import {
    installationPersonName,
    agentHref,
    agentLifecycleOf,
    agentLifecycleTone,
    type AgentLifecycle,
} from "@/modules/installations"
import { workspaceHref } from "@/modules/routes"
import { useInstallations } from "./useInstallations"
import type { DataSlot } from "@/modules/types"

/** The view `useInstanceRail` returns. */
export interface InstanceRailView {
    items: {
        id: string
        href: string
        name: string
        seed: string
        avatarUrl: string | null
        roleName: string
        isCurrent: boolean
        lifecycle: AgentLifecycle
        statusTone: "success" | "neutral" | "warning" | "accent"
    }[]
    slot: DataSlot<
        {
            id: string
            href: string
            name: string
            seed: string
            avatarUrl: string | null
            roleName: string
            isCurrent: boolean
            lifecycle: AgentLifecycle
            statusTone: "success" | "neutral" | "warning" | "accent"
        }[]
    >
}

/** The installed agents (one row per instance, as people of the team) for the switcher of the agent frame; no rows until they are known. */
export const useInstanceRail = (installationId: string): InstanceRailView => {
    const locale = useLocale() === "en" ? "en" : "vi"
    const installed = useInstallations()
    const workspaceId = useWorkspaceId()
    const catalog = useModuleCatalog()
    const items = (installed.installations ?? []).map((other) => {
        const lifecycle = agentLifecycleOf(other)
        const copy = catalog.modules[other.moduleKey]
        return {
            id: other.id,
            href: workspaceHref(workspaceId, agentHref(other.moduleKey, other.id)),
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
