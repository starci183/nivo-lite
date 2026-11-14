"use client"

import { useLocale, useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { useConnectionsRole } from "@/hooks/connections"
import { useAgentNodeRights, useNodeRightsWords } from "@/hooks/nodeRights"
import { useMutateAgreeAgentNodeRightsSwr, useQueryAgentWorkflowsSwr, useQueryModuleInstallationsSwr } from "@/hooks/swr"
import { toolLabelOf } from "@/modules/plugin-registry"
import { readinessRowsOf, type ReadinessWords } from "@/modules/agentWorkflows"
import { navigation } from "@/modules/i18n"
import { AUTOMATION_ROUTES, workspaceHref } from "@/modules/routes"
import { toolWordOf } from "@/modules/toolNames"
import type { ReadinessPickView, ReadinessRowView } from "@/modules/types"
import { useGraphQLWithToast } from "@/modules/toast"
import { useWorkspaceId } from "@/hooks/workspaces"
import { stepsLocaleOf } from "@/modules/workflowSteps"

/** The choice of one source of a contested stream, while its drawer is open. */
export interface WorkflowPick {
    readonly view: ReadinessPickView | null
    /** The account checked in the choice; null until one is. */
    readonly selected: string | null
    readonly isSaving: boolean
    readonly select: (connectionId: string) => void
    readonly close: () => void
    /** Stores the pick (`agreeAgentNodeRights` `triggerPicks`), then reads the workflows again. */
    readonly submit: () => void
}

/** Why the agent's workflows cannot run, one row per reason with its next step, and the choice a `needs_pick` row opens. */
export interface WorkflowReadiness {
    /** The reasons; undefined while the list is read. */
    readonly rows: ReadonlyArray<ReadinessRowView> | undefined
    /** Only the workspace owner stores a pick (the back end refuses anybody else). */
    readonly isOwner: boolean
    readonly open: (pick: ReadinessPickView) => void
    readonly pick: WorkflowPick
}

/** The words of every reason (the namespace `agentWorkflowPages`), the provider and tool names, and the accounts by their own names. */
const useReadinessWords = (accounts: ReadonlyArray<{ readonly connectionId: string; readonly name: string }>): ReadinessWords => {
    const t = useTranslations("agentWorkflowPages")
    const locale = useLocale()
    const nodeWords = useNodeRightsWords()
    return useMemo<ReadinessWords>(
        () => ({
            providerName: nodeWords.providerNameOf,
            toolName: (tool) =>
                tool === null
                    ? t("readinessToolGeneral")
                    : toolWordOf(tool, stepsLocaleOf(locale), toolLabelOf, t("readinessToolGeneral")),
            accountName: (connectionId) => accounts.find((one) => one.connectionId === connectionId)?.name ?? connectionId,
            notConnected: (provider) => t("readinessNotConnected", { provider }),
            triggerOff: (provider) => t("readinessTriggerOff", { provider }),
            needsPickStream: ({ provider, stream }) => t("readinessNeedsPickStream", { provider, stream }),
            needsPickStep: (provider) => t("readinessNeedsPickStep", { provider }),
            needsReconnect: ({ provider, account }) => t("readinessNeedsReconnect", { provider, account }),
            reconnect: t("readinessReconnect"),
            toolUnavailable: ({ tool, provider }) => t("readinessToolUnavailable", { tool, provider }),
            waiting: (provider) => t("readinessWaiting", { provider }),
            connect: (provider) => t("readinessConnect", { provider }),
            enableTrigger: t("readinessEnableTrigger"),
            pick: t("readinessPick"),
            openMap: t("readinessOpenMap"),
            seeConnections: t("readinessSeeConnections"),
        }),
        [t, locale, nodeWords, accounts],
    )
}

/**
 * The readiness of the workflows of an installed agent, read from the same list the table draws (`agentWorkflows` `readiness`): the
 * words of every reason (templates.md rule 8 and triggers.md rule 2), the accounts named by their own names, and the pick that
 * un-contests a stream.
 */
export const useWorkflowReadiness = (installationId: string): WorkflowReadiness => {
    const t = useTranslations("agentWorkflowPages")
    const locale = useLocale()
    const pathname = navigation.usePathname()
    const workspaceId = useWorkspaceId()
    const role = useConnectionsRole().role
    const runGraphQL = useGraphQLWithToast()
    const read = useQueryAgentWorkflowsSwr({ installationId, locale })
    const agreeWrite = useMutateAgreeAgentNodeRightsSwr()
    const agentId = useQueryModuleInstallationsSwr().data?.find((one) => one.id === installationId)?.agentId ?? null
    const nodeRights = useAgentNodeRights(agentId)
    const [view, setView] = useState<ReadinessPickView | null>(null)
    const [selected, setSelected] = useState<string | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const accounts = useMemo(() => ("items" in nodeRights.slot ? nodeRights.slot.items.accounts : []), [nodeRights.slot])
    const words = useReadinessWords(accounts)
    const data = read.data
    const rows = useMemo(
        () =>
            data === undefined
                ? undefined
                : readinessRowsOf(data, words, {
                      connectionsHref: workspaceHref(workspaceId, AUTOMATION_ROUTES.connections),
                      mapHrefOf: (key) => `${pathname}/${encodeURIComponent(key)}/map`,
                  }),
        [data, words, workspaceId, pathname],
    )
    const close = (): void => {
        setView(null)
        setSelected(null)
    }
    return {
        rows,
        isOwner: role === "owner",
        open: (pick) => {
            setSelected(null)
            setView(pick)
        },
        pick: {
            view,
            selected,
            isSaving,
            select: setSelected,
            close,
            submit: () => {
                if (view === null || selected === null) return
                setIsSaving(true)
                void runGraphQL(
                    () =>
                        agreeWrite.trigger({
                            installationId,
                            triggerPicks: [
                                { workflowId: view.workflowId, verb: view.verb, stream: view.stream, connectionId: selected },
                            ],
                        }),
                    { successMessage: t("readinessPicked") },
                )
                    .then(() => read.mutate())
                    .finally(() => {
                        setIsSaving(false)
                        close()
                    })
            },
        },
    }
}
