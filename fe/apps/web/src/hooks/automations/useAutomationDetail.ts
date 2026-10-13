import { useCallback, useState } from "react"
import type { AutomationCardView, ConfigValue } from "@/lib/automation-shared"
import type { AutomationCommandView, DbFailure, DbOutcome } from "@/modules/db"
import type { AutomationValues } from "@/modules/automations"

/** How the proposal came out: written by the model, or the standard wording. */
type ProposalNote = "proposal" | "fallback"

/** Runs a command of the back end for the open card and answers how it ended. */
export type CommandAction = (
    kind: "propose_body" | "run_now",
    templateKey: string,
) => Promise<DbOutcome<AutomationCommandView>>

/** What the open card edits: its settings and its wording. */
interface DetailForm {
    readonly key: string | null
    readonly values: AutomationValues
    readonly body: string
    readonly note: ProposalNote | null
    readonly isSaved: boolean
}

/** What the back end is doing for the open card. */
interface DetailWork {
    readonly isComposing: boolean
    readonly isStarting: boolean
    readonly isStarted: boolean
}

/** Everything the detail of the open card edits, and the commands it asks of the back end. */
export interface AutomationDetailState {
    readonly form: DetailForm
    readonly work: DetailWork
    readonly changeValue: (key: string, value: ConfigValue) => void
    readonly markSaved: (saved: boolean) => void
    readonly editBody: (value: string) => void
    /** Asks for the proposal of the open card, or of the card named. */
    readonly compose: (forKey?: string) => void
    readonly startRun: () => void
}

const formOf = (card: AutomationCardView | null): DetailForm => ({
    key: card?.key ?? null,
    values: { ...card?.config },
    body: card?.body ?? "",
    note: null,
    isSaved: false,
})

const IDLE: DetailWork = { isComposing: false, isStarting: false, isStarted: false }

const failureOf = (code: string | null): DbFailure => ({ kind: "unavailable", code: code ?? "command-failed" })

/**
 * The local state of the detail of the open card. It starts over when another card opens. The proposal and the run are commands the
 * back end runs: the action answers once the job wrote its result on the command row.
 */
export const useAutomationDetail = (
    card: AutomationCardView | null,
    command: CommandAction,
    onFailure: (failure: DbFailure) => void,
): AutomationDetailState => {
    const key = card?.key ?? null
    const [form, setForm] = useState<DetailForm>(() => formOf(card))
    const [work, setWork] = useState<DetailWork>(IDLE)

    if (key !== form.key) {
        setForm(formOf(card))
        setWork(IDLE)
    }

    const compose = useCallback(
        (forKey?: string) => {
            const target = forKey ?? key
            if (target === null) return
            setWork((previous) => ({ ...previous, isComposing: true }))
            void command("propose_body", target).then((outcome) => {
                setWork((previous) => ({ ...previous, isComposing: false }))
                if (outcome.kind !== "ok") return onFailure(outcome)
                const { proposal } = outcome.value
                if (outcome.value.status === "failed" || proposal === null) {
                    return onFailure(failureOf(outcome.value.faultCode))
                }
                setForm((previous) => ({
                    ...previous,
                    body: proposal.body,
                    note: proposal.generated ? "proposal" : "fallback",
                }))
            })
        },
        [command, key, onFailure],
    )

    const startRun = useCallback(() => {
        if (key === null) return
        setWork((previous) => ({ ...previous, isStarting: true, isStarted: false }))
        void command("run_now", key).then((outcome) => {
            setWork((previous) => ({ ...previous, isStarting: false }))
            if (outcome.kind !== "ok") return onFailure(outcome)
            if (outcome.value.status === "failed") return onFailure(failureOf(outcome.value.faultCode))
            setWork((previous) => ({ ...previous, isStarted: true }))
        })
    }, [command, key, onFailure])

    return {
        form,
        work,
        changeValue: (name, value) =>
            setForm((previous) => ({ ...previous, isSaved: false, values: { ...previous.values, [name]: value } })),
        markSaved: (saved) => setForm((previous) => ({ ...previous, isSaved: saved })),
        editBody: (value) => setForm((previous) => ({ ...previous, body: value, note: null })),
        compose,
        startRun,
    }
}
