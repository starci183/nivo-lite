"use client"

import { useCallback, useState } from "react"
import { mutate } from "swr"
import { useRefreshInstallation } from "@/hooks/agentSettings"
import {
    useMutateApplySetupSwr,
    useMutateSetSetupGateSwr,
    QUERY_SETUP_STATE_SWR_KEY,
    QUERY_SETUP_VERSIONS_SWR_KEY,
} from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"

/** What a gate change asks. */
type GateChange = { readonly action: "confirm" | "reopen" | "edit"; readonly evidence?: string }

/** What the last apply said: nothing yet, or applied with the new version. */
type ApplyNote = { readonly tone: "idle" | "applied"; readonly version: number }

const SETUP_KEYS: ReadonlyArray<string> = [QUERY_SETUP_STATE_SWR_KEY, QUERY_SETUP_VERSIONS_SWR_KEY]
const isSetupKey = (key: unknown): boolean => Array.isArray(key) && SETUP_KEYS.includes(key[0])

/** The gate checklist of the setup: confirm, reopen or edit one gate, and apply the draft as a version. A failure was already toasted. */
export const useSetupGates = (setupSessionId: string, installationId: string) => {
    const runGraphQL = useGraphQLWithToast()
    const setGate = useMutateSetSetupGateSwr()
    const applySetup = useMutateApplySetupSwr()
    const refreshInstallation = useRefreshInstallation()
    const [editing, setEditing] = useState("")
    const [editText, setEditText] = useState("")
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
        await mutate(isSetupKey)
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
