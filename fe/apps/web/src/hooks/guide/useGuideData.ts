"use client"

import { useEffect, useMemo, useState } from "react"
import {
    useQueryBrainSwr,
    useQueryBrainTodoSwr,
    useQueryConnectionsSwr,
    useQueryKnowledgeSourcesSwr,
    useQueryModuleInstallationsSwr,
} from "@/hooks/swr"
import { useWorkspaceId } from "@/hooks/workspaces"
import { queryInboxLeads } from "@/modules/api/graphql/queries/query-inbox-leads"
import type { InboxLeadsQuery } from "@/modules/api"
import { NO_SIGNALS, type GuideDoc, type GuideSignals } from "@/modules/guide"
import { connectionHref, docsOfData } from "./guideDocs"

/** The workspace things the drawer searches and the figures its rules read. */
export interface GuideData {
    readonly docs: ReadonlyArray<GuideDoc>
    readonly signals: GuideSignals
    /** Accounts an agent needs and has not been given: the agent's connections page grants them. */
    readonly grantable: ReadonlyArray<GuideGrantable>
}

/** One account an agent could be given. */
export interface GuideGrantable {
    readonly id: string
    readonly connection: string
    readonly agent: string
    readonly href: string
}

type Leads = InboxLeadsQuery["inboxLeads"]

/** The most customers the guide reads, once. */
const LEADS_LIMIT = 60

/**
 * Everything the guide knows about the workspace, read ONCE when the drawer first mounts, through the console's own reads (agents,
 * connections, documents, the Second Brain and its counts) and the one lead list the inbox reads. Nothing here polls.
 */
export const useGuideData = (): GuideData => {
    const workspaceId = useWorkspaceId()
    const installations = useQueryModuleInstallationsSwr().data
    const connections = useQueryConnectionsSwr().data
    const brain = useQueryBrainSwr().data
    const todo = useQueryBrainTodoSwr().data
    const documents = useQueryKnowledgeSourcesSwr(undefined, 0).data
    const [leads, setLeads] = useState<Leads | undefined>(undefined)

    useEffect(() => {
        let isLive = true
        void queryInboxLeads({
            request: { tab: "all", channel: null, agentId: null, sort: "recent", search: null, limit: LEADS_LIMIT },
            headers: { "X-Workspace-Id": workspaceId },
        })
            .then((result) => {
                if (isLive && result.data) setLeads(result.data.inboxLeads)
            })
            .catch(() => undefined)
        return () => {
            isLive = false
        }
    }, [workspaceId])

    return useMemo<GuideData>(() => {
        const withoutConnection = (installations ?? [])
            .filter(
                (one) =>
                    one.connectionNeeds.length > 0 &&
                    one.agentId !== null &&
                    !(connections ?? []).some((connection) => connection.agentIds.includes(one.agentId ?? "")),
            )
            .map((one) => ({
                id: one.id,
                name: one.agentName,
                href: `/agents/${one.moduleKey}/${one.id}/connections`,
            }))
        const signals: GuideSignals = {
            ...NO_SIGNALS,
            agentsWithoutConnection: connections === undefined ? [] : withoutConnection,
            failedConnections: (connections ?? [])
                .filter((one) => one.status === "error")
                .map((one) => ({ id: one.id, name: one.name, href: connectionHref(one.provider, one.id) })),
            pendingFacts: todo?.facts ?? 0,
            openFindings: todo?.findings ?? 0,
            openQuestions: todo?.questions ?? 0,
            leadsWaiting: leads?.counts.needsYou ?? 0,
            leadsNew: leads?.counts.new ?? 0,
            unmatchedPayments: (leads?.leads ?? []).filter((one) => one.isUnmatched).length,
            failedDocuments: (documents ?? []).filter((one) => one.status === "failed").length,
        }
        const grantable = (connections ?? []).flatMap((connection) =>
            (installations ?? [])
                .filter(
                    (one) =>
                        one.agentId !== null &&
                        !connection.agentIds.includes(one.agentId) &&
                        one.connectionNeeds.some((need) => need.providers.includes(connection.provider)),
                )
                .map((one) => ({
                    id: `${connection.id}-${one.id}`,
                    connection: connection.name,
                    agent: one.agentName,
                    href: `/agents/${one.moduleKey}/${one.id}/connections`,
                })),
        )
        return { docs: docsOfData({ installations, connections, brain, documents, leads }), signals, grantable }
    }, [installations, connections, brain, todo, documents, leads])
}
