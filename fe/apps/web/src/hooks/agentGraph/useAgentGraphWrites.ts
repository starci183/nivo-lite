"use client"

import { mutate } from "@/modules/viewer-cache"
import {
    QUERY_AGENT_GRAPH_COVERAGE_SWR_KEY,
    QUERY_AGENT_GRAPH_SWR_KEY,
    QUERY_AGENT_GRAPH_VERSIONS_SWR_KEY,
    useMutateConfirmAgentGraphProposalSwr,
    useMutateDeclineAgentGraphProposalSwr,
    useMutatePublishAgentGraphSwr,
    useMutateRestoreAgentGraphVersionSwr,
    useMutateSetAgentGraphModeSwr,
    useMutateSaveAgentGraphDraftSwr,
} from "@/hooks/swr"
import type { AgentGraphWireDocument } from "@/modules/agent-graph"
import { toast, useGraphQLWithToast } from "@/modules/toast"

const GRAPH_KEYS: ReadonlySet<unknown> = new Set([
    QUERY_AGENT_GRAPH_SWR_KEY,
    QUERY_AGENT_GRAPH_VERSIONS_SWR_KEY,
    QUERY_AGENT_GRAPH_COVERAGE_SWR_KEY,
])
const isGraphKey = (key: unknown): boolean => Array.isArray(key) && GRAPH_KEYS.has(key[0])

/** What a write needs to know about the graph it was made on: whose it is and the revision of the draft it read. */
interface GraphTarget {
    readonly agentId: string
    readonly draftRev: number
}

/**
 * The writes of the action graph: save the draft (the whole document goes back with the revision it was read at, so two people
 * cannot overwrite each other), publish it, go back to a version, confirm or decline a proposal and switch the mode. A failure was
 * already toasted, with the reason the back end gave in the owner's words; each write reads the graph again.
 */
export const useAgentGraphWrites = (onSaved: (isDraftEmpty: boolean) => void) => {
    const runGraphQL = useGraphQLWithToast()
    const save = useMutateSaveAgentGraphDraftSwr()
    const publish = useMutatePublishAgentGraphSwr()
    const restore = useMutateRestoreAgentGraphVersionSwr()
    const decline = useMutateDeclineAgentGraphProposalSwr()
    const confirm = useMutateConfirmAgentGraphProposalSwr()
    const setMode = useMutateSetAgentGraphModeSwr()
    const done = async (result: unknown, isDraftEmpty: boolean): Promise<boolean> => {
        if (result === undefined) return false
        onSaved(isDraftEmpty)
        await mutate(isGraphKey)
        return true
    }
    // The three roads that make a version live (publish, restore, confirm a proposal) are one call each, with their own success toast and
    // reads (rights.md: a node declares its mode; the engine has no upgrade gate, so no version waits for an owner's yes).
    const live = async (run: () => Promise<unknown>, successMessage: string): Promise<boolean> =>
        (await runGraphQL(
            async () => {
                await run()
                toast.success(successMessage)
                await done(true, true)
                return true
            },
            { showSuccessToast: false },
        )) === true
    return {
        refresh: async (): Promise<boolean> => done(true, true),
        saveDocument: async (
            target: GraphTarget,
            document: AgentGraphWireDocument,
            successMessage: string,
        ): Promise<boolean> =>
            done(
                await runGraphQL(
                    () =>
                        save.trigger({
                            agentId: target.agentId,
                            documentJson: JSON.stringify(document),
                            rev: target.draftRev,
                        }),
                    { successMessage },
                ),
                false,
            ),
        publish: async (agentId: string, note: string, successMessage: string): Promise<boolean> =>
            live(() => publish.trigger({ agentId, note }), successMessage),
        restore: async (agentId: string, versionId: string, successMessage: string): Promise<boolean> =>
            live(() => restore.trigger({ agentId, versionId }), successMessage),
        confirm: async (agentId: string, proposalId: string, successMessage: string): Promise<boolean> =>
            live(() => confirm.trigger({ agentId, proposalId }), successMessage),
        mode: async (agentId: string, mode: string): Promise<void> => {
            const result = await runGraphQL(() => setMode.trigger({ agentId, mode }), { showSuccessToast: false })
            if (result !== undefined) await mutate(isGraphKey)
        },
        decline: async (agentId: string, proposalId: string, successMessage: string): Promise<void> => {
            const result = await runGraphQL(() => decline.trigger({ agentId, proposalId }), { successMessage })
            if (result !== undefined) await mutate(isGraphKey)
        },
    }
}
