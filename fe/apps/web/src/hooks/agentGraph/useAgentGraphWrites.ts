"use client"

import { mutate } from "swr"
import {
    QUERY_AGENT_GRAPH_SWR_KEY,
    QUERY_AGENT_GRAPH_VERSIONS_SWR_KEY,
    useMutateDeclineAgentGraphProposalSwr,
    useMutatePublishAgentGraphSwr,
    useMutateRestoreAgentGraphVersionSwr,
    useMutateSaveAgentGraphDraftSwr,
} from "@/hooks/swr"
import { documentWithBranch } from "@/modules/agent-graph"
import type { AgentGraphWire } from "@/modules/agent-graph"
import type { AgentGraphBranchForm } from "@/modules/types"
import { useGraphQLWithToast } from "@/modules/toast"

const GRAPH_KEYS: ReadonlySet<unknown> = new Set([QUERY_AGENT_GRAPH_SWR_KEY, QUERY_AGENT_GRAPH_VERSIONS_SWR_KEY])
const isGraphKey = (key: unknown): boolean => Array.isArray(key) && GRAPH_KEYS.has(key[0])

/** What a write needs to know about the graph it was made on. */
interface GraphTarget {
    readonly agentId: string
    readonly draftRev: number
    readonly wire: AgentGraphWire
}

/** Which branch of which condition node a save is about, with the form the owner filled. */
interface BranchSave {
    readonly nodeKey: string
    readonly branchKey: string
    readonly form: AgentGraphBranchForm
}

/**
 * The writes of the action graph: save a branch to the draft (the whole document goes back with the revision it was read at),
 * publish, go back to a version, and decline a proposal. A failure was already toasted; each write reads the graph again.
 */
export const useAgentGraphWrites = (onSaved: (isDraftEmpty: boolean) => void) => {
    const runGraphQL = useGraphQLWithToast()
    const save = useMutateSaveAgentGraphDraftSwr()
    const publish = useMutatePublishAgentGraphSwr()
    const restore = useMutateRestoreAgentGraphVersionSwr()
    const decline = useMutateDeclineAgentGraphProposalSwr()
    const done = async (result: unknown, isDraftEmpty: boolean): Promise<void> => {
        if (result === undefined) return
        onSaved(isDraftEmpty)
        await mutate(isGraphKey)
    }
    return {
        saveBranch: async (target: GraphTarget, change: BranchSave): Promise<void> => {
            const document = documentWithBranch(target.wire.document, change, change.form)
            const documentJson = JSON.stringify(document)
            await done(
                await runGraphQL(() => save.trigger({ agentId: target.agentId, documentJson, rev: target.draftRev }), {
                    showSuccessToast: false,
                }),
                false,
            )
        },
        publish: async (agentId: string, note: string): Promise<void> =>
            done(await runGraphQL(() => publish.trigger({ agentId, note }), { showSuccessToast: false }), true),
        restore: async (agentId: string, versionId: string): Promise<void> =>
            done(await runGraphQL(() => restore.trigger({ agentId, versionId }), { showSuccessToast: false }), true),
        decline: async (agentId: string, proposalId: string): Promise<void> => {
            const result = await runGraphQL(() => decline.trigger({ agentId, proposalId }), { showSuccessToast: false })
            if (result !== undefined) await mutate(isGraphKey)
        },
    }
}
