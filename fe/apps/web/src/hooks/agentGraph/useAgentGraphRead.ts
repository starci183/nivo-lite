"use client"

import { useFormatter, useLocale, useTranslations } from "next-intl"
import { useMemo } from "react"
import { useInstallations } from "@/hooks/installations"
import { useQueryAgentGraphSwr, useQueryAgentGraphVersionsSwr, useQueryApproverDirectorySwr } from "@/hooks/swr"
import { agentGraphOfWire, parseAgentGraphWire } from "@/modules/agent-graph"
import type { AgentGraphWire } from "@/modules/agent-graph"
import type { AgentGraphData, AgentGraphMemberData, DataSlot } from "@/modules/types"
import { useAgentGraphWords } from "./useAgentGraphWords"

/** The graph, as the back end carries it and as the panes draw it. */
interface AgentGraphRead {
    readonly agentId: string
    readonly draftRev: number
    readonly wire: AgentGraphWire
    readonly data: AgentGraphData
}

/** The status of the read: failed, still waiting, or the graph. */
const slotOf = (isFailed: boolean, isWaiting: boolean, data: AgentGraphData | undefined): DataSlot<AgentGraphData> => {
    if (isFailed) return { isError: true }
    return data === undefined ? { isLoading: isWaiting } : { items: data }
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
    const { installations } = useInstallations()
    const agentId = installations?.find((installation) => installation.id === installationId)?.agentId ?? null
    const graph = useQueryAgentGraphSwr(agentId === null ? null : { agentId, locale })
    const versions = useQueryAgentGraphVersionsSwr(agentId === null ? null : { agentId })
    const directory = useQueryApproverDirectorySwr()
    const wire = useMemo(() => (graph.data === undefined ? undefined : parseAgentGraphWire(graph.data)), [graph.data])
    const members = useMemo(
        (): ReadonlyArray<AgentGraphMemberData> =>
            (directory.data ?? [])
                .filter((member) => member.status !== "disabled")
                .map((member) => ({ id: member.memberId, name: member.name, upToVnd: null })),
        [directory.data],
    )
    const read: AgentGraphRead | undefined =
        agentId === null ||
        graph.data === undefined ||
        wire === undefined ||
        wire === null ||
        versions.data === undefined
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
                          changes,
                      },
                      {
                          ...words,
                          t,
                          date: (iso) =>
                              format.dateTime(new Date(iso), { day: "2-digit", month: "2-digit", year: "numeric" }),
                      },
                  ),
              }
    const isFailed = graph.error !== undefined || versions.error !== undefined || wire === null
    const isWaiting = graph.isLoading || versions.isLoading || installations === undefined
    const slot: DataSlot<AgentGraphData> = slotOf(isFailed, isWaiting, read?.data)
    return { slot, read, reload: () => void Promise.all([graph.mutate(), versions.mutate()]) }
}
