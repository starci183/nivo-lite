"use client"

import { useFormatter, useLocale, useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { useMemo } from "react"
import { slotOfReads } from "@/hooks/slot"
import {
    useQueryModuleInstallationsSwr,
    useQueryAgentGraphCoverageSwr,
    useQueryAgentGraphRunSwr,
    useQueryAgentGraphSwr,
    useQueryAgentGraphVersionsSwr,
    useQueryApproverDirectorySwr,
} from "@/hooks/swr"
import { agentGraphOfWire, parseAgentGraphTrace, parseAgentGraphWire } from "@/modules/agent-graph"
import type { AgentGraphWire } from "@/modules/agent-graph"
import type { AgentGraphData, AgentGraphMemberData, DataSlot, SlotRead } from "@/modules/types"
import { useAgentGraphWords } from "./useAgentGraphWords"

/** The graph, as the back end carries it and as the panes draw it. */
export interface AgentGraphRead {
    readonly agentId: string
    readonly draftRev: number
    readonly wire: AgentGraphWire
    readonly data: AgentGraphData
}

/**
 * Reads the action graph of an instance through the W6 contract (`agentGraph`, `agentGraphVersions`) and the people an approver can
 * be (`approverDirectory`). The JSON texts of the graph are parsed once, with their schemas, in `parseAgentGraphWire`; what the
 * panes draw is made from that and the directory. `changes` is how many branches were saved to the draft on this screen.
 */
export const useAgentGraphRead = (installationId: string, changes: number) => {
    const t = useTranslations("agentGraph")
    const format = useFormatter()
    const locale = useLocale()
    const words = useAgentGraphWords(t)
    const installations = useQueryModuleInstallationsSwr()
    const agentId = installations.data?.find((installation) => installation.id === installationId)?.agentId ?? null
    const graph = useQueryAgentGraphSwr(agentId === null ? null : { agentId, locale })
    const versions = useQueryAgentGraphVersionsSwr(agentId === null ? null : { agentId })
    const directory = useQueryApproverDirectorySwr()
    const coverage = useQueryAgentGraphCoverageSwr(agentId === null ? null : { agentId })
    const workItemId = useSearchParams().get("run") ?? ""
    const runRead = useQueryAgentGraphRunSwr(workItemId === "" ? null : { workItemId })
    const run =
        runRead.data === undefined
            ? null
            : {
                  id: runRead.data.decisionId,
                  version: runRead.data.version,
                  outcome: runRead.data.outcome,
                  closedAs: runRead.data.closedAs,
                  steps: parseAgentGraphTrace(runRead.data.traceJson) ?? [],
              }
    const wire = useMemo(() => (graph.data === undefined ? undefined : parseAgentGraphWire(graph.data)), [graph.data])
    const members = useMemo(
        (): ReadonlyArray<AgentGraphMemberData> | undefined =>
            directory.data
                ?.filter((member) => member.status !== "disabled")
                .map((member) => ({ id: member.memberId, name: member.name, upToVnd: null })),
        [directory.data],
    )
    const read: AgentGraphRead | undefined =
        agentId === null ||
        graph.data === undefined ||
        wire === undefined ||
        wire === null ||
        versions.data === undefined ||
        directory.data === undefined ||
        members === undefined ||
        coverage.data === undefined
            ? undefined
            : {
                  agentId,
                  draftRev: graph.data.draftRev,
                  wire,
                  data: agentGraphOfWire(
                      {
                          wire,
                          mode: graph.data.mode,
                          activeVersionId: graph.data.activeVersionId ?? null,
                          versions: versions.data,
                          members,
                          coverage: coverage.data,
                          run,
                          changes,
                          isDraftChanged: graph.data.isDraftChanged,
                      },
                      {
                          ...words,
                          t,
                          date: (iso) =>
                              format.dateTime(new Date(iso), { day: "2-digit", month: "2-digit", year: "numeric" }),
                      },
                  ),
              }
    const parsedGraphRead: SlotRead<typeof graph.data> = {
        data: wire === null ? undefined : graph.data,
        error: graph.error ?? (wire === null ? new Error("The agent graph payload is invalid") : undefined),
        isLoading: graph.isLoading,
        isValidating: graph.isValidating,
    }
    const reads = [
        installations,
        parsedGraphRead,
        versions,
        directory,
        coverage,
        ...(workItemId === "" ? [] : [runRead]),
    ]
    const slot: DataSlot<AgentGraphData> = slotOfReads(reads, () => {
        if (read === undefined)
            throw new Error("A ready action graph requires its parsed graph and settled supporting reads")
        return read.data
    })
    return {
        slot,
        runId: run?.id ?? "",
        read,
        reload: () => {
            void installations.mutate()
            void graph.mutate()
            void versions.mutate()
            void directory.mutate()
            void coverage.mutate()
            if (workItemId !== "") void runRead.mutate()
        },
    }
}
