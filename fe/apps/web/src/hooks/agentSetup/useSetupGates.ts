"use client"

import { useCallback, useState } from "react"
import { mutate } from "@/modules/viewer-cache"
import { useRefreshInstallation } from "@/hooks/agentSettings"
import {
    useMutateApplySetupSwr,
    useMutateSetSetupGateSwr,
    QUERY_AGENT_GRAPH_COVERAGE_SWR_KEY,
    QUERY_AGENT_GRAPH_SWR_KEY,
    QUERY_AGENT_GRAPH_VERSIONS_SWR_KEY,
    QUERY_SETUP_STATE_SWR_KEY,
    QUERY_SETUP_VERSIONS_SWR_KEY,
} from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import { useEditFocus } from "./useEditFocus"

/** What a gate change asks. */
type GateChange = { readonly action: "confirm" | "reopen" | "edit"; readonly evidence?: string | undefined }

/** What the last apply said: nothing yet, or applied with the new version. */
type ApplyNote = { readonly tone: "idle" | "applied"; readonly version: number }

const SETUP_KEYS: ReadonlySet<unknown> = new Set([QUERY_SETUP_STATE_SWR_KEY, QUERY_SETUP_VERSIONS_SWR_KEY])
const isSetupKey = (key: unknown): boolean => Array.isArray(key) && SETUP_KEYS.has(key[0])

/** An apply publishes a graph version too, so the head of the map ("version N running") is read again with the setup. */
const APPLY_KEYS: ReadonlySet<unknown> = new Set([
    ...SETUP_KEYS,
    QUERY_AGENT_GRAPH_SWR_KEY,
    QUERY_AGENT_GRAPH_VERSIONS_SWR_KEY,
    QUERY_AGENT_GRAPH_COVERAGE_SWR_KEY,
])
const isApplyKey = (key: unknown): boolean => Array.isArray(key) && APPLY_KEYS.has(key[0])

/** The gate checklist of the setup: confirm, reopen or edit one gate, and apply the draft as a version. A failure was already toasted. */
export const useSetupGates = (setupSessionId: string, installationId: string) => {
    const runGraphQL = useGraphQLWithToast()
    const setGate = useMutateSetSetupGateSwr()
    const applySetup = useMutateApplySetupSwr()
    const refreshInstallation = useRefreshInstallation()
    const [editing, setEditing] = useState("")
    const [editText, setEditText] = useState("")
    useEditFocus(editing)
    const [applyNote, setApplyNote] = useState<ApplyNote>({ tone: "idle", version: 0 })
    const gate = useCallback(
        async (gateKey: string, change: GateChange): Promise<void> => {
            const changed = await runGraphQL(
                () =>
                    setGate.trigger({
                        setupSessionId,
                        gateKey,
                        action: change.action,
                        evidence: change.evidence ?? "",
                    }),
                { showSuccessToast: false },
            )
            if (changed === undefined) return
            setEditing("")
            await mutate(isSetupKey)
        },
        [runGraphQL, setGate, setupSessionId],
    )
    const apply = useCallback(async (): Promise<void> => {
        setApplyNote({ tone: "idle", version: 0 })
        if (installationId === "") return
        const applied = await runGraphQL(() => applySetup.trigger({ installationId }), { showSuccessToast: false })
        if (applied === undefined) return
        setApplyNote({ tone: "applied", version: applied.version })
        await mutate(isApplyKey)
        await refreshInstallation()
    }, [runGraphQL, applySetup, installationId, refreshInstallation])
    return {
        editing,
        editText,
        setEditText,
        startEdit: (gateKey: string, evidence: string) => {
            setEditing(gateKey)
            setEditText(evidence)
        },
        stopEdit: () => setEditing(""),
        isGating: setGate.isMutating,
        gate,
        isApplying: applySetup.isMutating,
        applyNote,
        apply,
    }
}
