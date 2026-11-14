"use client"

import { useMemo } from "react"
import {
    useQueryBrainSwr,
    useQueryBrainTodoSwr,
    useQueryConnectionsSwr,
    useQueryKnowledgeSourcesSwr,
    useQueryModuleInstallationsSwr,
} from "@/hooks/swr"
import { NO_SIGNALS, type GuideDoc, type GuideSignals } from "@/modules/guide"
import { connectionHref, docsOfData } from "./guide.shared"

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

/**
 * Everything the guide knows about the workspace, read ONCE when the drawer first mounts, through the console's own reads (agents,
 * connections, documents, the Second Brain and its counts). Nothing here polls.
 */
export const useGuideData = (): GuideData => {
    const installations = useQueryModuleInstallationsSwr().data
    const connections = useQueryConnectionsSwr().data
    const brain = useQueryBrainSwr().data
    const todo = useQueryBrainTodoSwr().data
    const documents = useQueryKnowledgeSourcesSwr(undefined, 0).data
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
            openQuestions: todo?.questions ?? 0,
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
        return { docs: docsOfData({ installations, connections, brain, documents }), signals, grantable }
    }, [installations, connections, brain, todo, documents])
}
