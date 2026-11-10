"use client"

import { useLocale, useTranslations } from "next-intl"
import { useCallback, useEffect, useMemo, useRef } from "react"
import type { FlowGraphPositions } from "@starci/grammar/common"
import { useInstallations, useInstanceRail } from "@/hooks/installations"
import { slotOfSwr } from "@/hooks/slot"
import { useWorkspaceId } from "@/hooks/workspaces"
import { workflowGraphViewOf, type WorkflowGraphView } from "@/modules/agentWorkflowGraph"
import { isModuleKey } from "@/modules/catalog"
import { agentHref } from "@/modules/installations"
import { workspaceHref } from "@/modules/routes"
import type { DataSlot } from "@/modules/types"
import { useMutateSaveAgentGraphLayoutSwr, useQueryAgentGraphLayoutSwr, useQueryAgentWorkflowGraphSwr } from "@/hooks/swr"
import { paramLabelOf } from "@nivo-lite/blocks-core/graph"

export type { WorkflowGraphView } from "@/modules/agentWorkflowGraph"

/** The quiet time after a drag before the arrangement is saved. */
const SAVE_DELAY_MS = 600

/** The Graph tab of an agent as the page draws it. */
interface AgentWorkflowGraphRead {
    readonly slot: DataSlot<WorkflowGraphView>
    /** The name of the agent, empty until read. */
    readonly agentLabel: string
    /** The page of the list of workflows. */
    readonly listHref: string
    readonly retry: () => void
    /** The arrangement the user dragged; empty is the automatic layout. */
    readonly positions: FlowGraphPositions
    readonly savePositions: (positions: FlowGraphPositions) => void
}

/** The workflows of one agent as nodes and edges, every word resolved, every block with the page it opens. */
export const useAgentWorkflowGraphView = (module: string, installationId: string): AgentWorkflowGraphRead => {
    const t = useTranslations("agentGraphTab")
    const locale = useLocale() === "en" ? "en" : "vi"
    const workspaceId = useWorkspaceId()
    const installed = useInstallations()
    const rail = useInstanceRail(installationId)
    const read = useQueryAgentWorkflowGraphSwr(installationId)
    const base = `${agentHref(isModuleKey(module) ? module : "chatbot", installationId)}/workflows`
    const listHref = workspaceHref(workspaceId, base)
    const { data } = read
    const layout = useQueryAgentGraphLayoutSwr(installationId)
    const save = useMutateSaveAgentGraphLayoutSwr()
    const { trigger } = save
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    useEffect(() => () => clearTimeout(timer.current), [])
    // The saved arrangement is kept per workflow key; the canvas names its blocks by workflow id.
    const keyOfId = useMemo(() => new Map((data?.workflows ?? []).map((entry) => [entry.id, entry.key])), [data])
    const positions = useMemo<FlowGraphPositions>(() => {
        const saved = layout.data?.positions
        // Until the saved arrangement is read (or when it fails) the canvas keeps its automatic layout.
        if (saved === undefined) return {}
        const idOfKey = new Map([...keyOfId].map(([id, key]) => [key, id]))
        return Object.fromEntries(
            saved.flatMap((one): Array<[string, { x: number; y: number }]> => {
                const id = idOfKey.get(one.workflowKey)
                return id === undefined ? [] : [[id, { x: one.x, y: one.y }]]
            }),
        )
    }, [layout.data, keyOfId])
    // Saved on drag end after a short quiet time; an empty map (the reset control) clears the saved arrangement.
    const savePositions = useCallback(
        (next: FlowGraphPositions) => {
            clearTimeout(timer.current)
            timer.current = setTimeout(() => {
                const rows = Object.entries(next).flatMap(([id, at]) => {
                    const workflowKey = keyOfId.get(id)
                    return workflowKey === undefined ? [] : [{ workflowKey, x: at.x, y: at.y }]
                })
                void trigger({ installationId, positions: rows }).then(() => layout.mutate())
            }, SAVE_DELAY_MS)
        },
        [keyOfId, trigger, installationId, layout],
    )
    const view = useMemo(
        () =>
            data === undefined
                ? undefined
                : workflowGraphViewOf(
                      data,
                      { noInput: t("noInput"), openEntry: t("openEntry"), paramLabel: (name) => paramLabelOf(name, locale) },
                      {
                          workflowHref: (key) => `${listHref}/${key}`,
                          agentGraphHref: (other) => {
                              const found = installed.installations?.find((one) => one.moduleKey === other)
                              return found === undefined || !isModuleKey(other)
                                  ? null
                                  : workspaceHref(workspaceId, agentHref(other, found.id, "graph"))
                          },
                      },
                  ),
        [data, t, locale, listHref, installed.installations, workspaceId],
    )
    return {
        slot: slotOfSwr({ data: view, error: read.error, isLoading: read.isLoading }),
        agentLabel: rail.items.find((item) => item.isCurrent)?.name ?? "",
        listHref,
        retry: () => void read.mutate(),
        positions,
        savePositions,
    }
}
