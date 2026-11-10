"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useMemo } from "react"
import { useWorkspaceId } from "@/hooks/workspaces"
import { AGENTS_ROUTE, workItemHref, workspaceHref } from "@/modules/routes"
import type { RunDetailContext } from "@/modules/agentRuns"
import { runPathOf } from "./agentRuns.shared"

/** The words, the clock and the places the views of the runs need: one object, made again only when the language or the agent changes. */
export const useRunContext = (module: string, installationId: string): RunDetailContext => {
    const t = useTranslations("agentRuns")
    const format = useFormatter()
    const workspaceId = useWorkspaceId()
    return useMemo(
        () => ({
            t: (key, values) => t(key, values),
            has: (key) => t.has(key),
            timeOf: (iso) =>
                format.dateTime(new Date(iso), { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }),
            clockOf: (iso) =>
                format.dateTime(new Date(iso), { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }),
            hrefOf: (runId) => workspaceHref(workspaceId, runPathOf(module, installationId, runId)),
            chatHref: workspaceHref(workspaceId, `${AGENTS_ROUTE}/${module}/${installationId}/chat`),
            setupHref: workspaceHref(workspaceId, `${AGENTS_ROUTE}/${module}/${installationId}/setup`),
            workflowHrefOf: (key) => workspaceHref(workspaceId, `${AGENTS_ROUTE}/${module}/${installationId}/workflows/${key}`),
            decideHrefOf: (workItemId) => workspaceHref(workspaceId, workItemHref(module, workItemId)),
        }),
        [t, format, workspaceId, module, installationId],
    )
}
