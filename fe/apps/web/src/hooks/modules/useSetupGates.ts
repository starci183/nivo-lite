import { useState, useTransition } from "react"
import type { DbOutcome } from "@/modules/db"
import { navigation } from "@/modules/i18n"
import type { SetupSession } from "@/modules/installations"

/** What a gate change asks. */
type GateChange = { readonly action: "confirm" | "reopen" | "edit"; readonly evidence?: string }

/** The commands of the checklist the connected block passes in. */
type GateCommands = {
    readonly change: (setupSessionId: string, gateKey: string, change: GateChange) => Promise<DbOutcome<SetupSession>>
    readonly apply: (installationId: string) => Promise<DbOutcome<{ readonly version: number }>>
}

/** What the last apply said: nothing yet, applied with the new version, or refused with the reason. */
type ApplyNote = { readonly tone: "idle" | "applied" | "refused"; readonly version: number; readonly text: string }

/** What the checklist hands the block. */
type SetupGates = {
    /** The key of the gate being edited; empty when none. */
    readonly editing: string
    readonly editText: string
    readonly setEditText: (text: string) => void
    readonly startEdit: (gateKey: string, evidence: string) => void
    readonly stopEdit: () => void
    readonly isGating: boolean
    readonly gateFailure: string
    readonly gate: (gateKey: string, change: GateChange) => void
    readonly isApplying: boolean
    readonly applyNote: ApplyNote
    readonly apply: () => void
}

/** The gate checklist of the setup: confirm, reopen or edit one gate (the answer replaces the session), and apply the draft as a version. */
export const useSetupGates = (
    session: SetupSession,
    setSession: (session: SetupSession) => void,
    installationId: string,
    commands: GateCommands,
): SetupGates => {
    const router = navigation.useRouter()
    const [editing, setEditing] = useState("")
    const [editText, setEditText] = useState("")
    const [gateFailure, setGateFailure] = useState("")
    const [applyNote, setApplyNote] = useState<ApplyNote>({ tone: "idle", version: 0, text: "" })
    const [isGating, startGating] = useTransition()
    const [isApplying, startApplying] = useTransition()
    const gate = (gateKey: string, change: GateChange) => {
        setGateFailure("")
        startGating(async () => {
            const outcome = await commands.change(session.id, gateKey, change)
            if (outcome.kind !== "ok") {
                setGateFailure(outcome.code)
                return
            }
            setSession(outcome.value)
            setEditing("")
        })
    }
    const apply = () => {
        setApplyNote({ tone: "idle", version: 0, text: "" })
        if (installationId === "") return
        startApplying(async () => {
            const outcome = await commands.apply(installationId)
            if (outcome.kind !== "ok") {
                setApplyNote({ tone: "refused", version: 0, text: outcome.code })
                return
            }
            setApplyNote({ tone: "applied", version: outcome.value.version, text: "" })
            router.refresh()
        })
    }
    return {
        editing,
        editText,
        setEditText,
        startEdit: (gateKey, evidence) => {
            setEditing(gateKey)
            setEditText(evidence)
        },
        stopEdit: () => setEditing(""),
        isGating,
        gateFailure,
        gate,
        isApplying,
        applyNote,
        apply,
    }
}
