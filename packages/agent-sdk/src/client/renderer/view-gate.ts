import type { DataSlot } from "../../slot/slot.types"

/** Whether each bound read of the view has answered once, by the address of the read (`<node id>.<slot>`). */
export type GateAnswers = Readonly<Record<string, boolean>>

/** What a view gate holds: who has answered, and whether the view has shown its first data. */
export interface GateState {
    /** Whether each bound read that reported has answered once. */
    readonly answers: GateAnswers
    /** Whether every read has answered once; from then on a read reloads on its own and the view never gates again. */
    readonly isOpened: boolean
}

/** What a read tells the gate. */
export type GateAction =
    | { readonly kind: "report"; readonly key: string; readonly isAnswered: boolean }
    | { readonly kind: "forget"; readonly key: string }
    | { readonly kind: "open" }

/** A gate no read has reported to. */
export const INITIAL_GATE: GateState = { answers: {}, isOpened: false }

/** Whether a slot is an answer: anything but loading (ready, empty, error and forbidden all settle the read). */
export const isAnswered = (slot: DataSlot<unknown>): boolean => !("isLoading" in slot)

/** Whether the reads that reported have all answered, and at least one did. */
export const isSettled = (answers: GateAnswers): boolean => {
    const states = Object.values(answers)
    return states.length > 0 && states.every(Boolean)
}

/** Whether the view still waits for a read that has not answered once: its reads then all show their skeleton together. */
export const isGated = (state: GateState): boolean =>
    !state.isOpened && Object.values(state.answers).some((answered) => !answered)

/** The gate after a read reported, left, or the view opened; the same object when nothing changed. */
export const gateReducer = (state: GateState, action: GateAction): GateState => {
    if (action.kind === "open") return state.isOpened ? state : { ...state, isOpened: true }
    if (action.kind === "report") {
        if (state.answers[action.key] === action.isAnswered) return state
        return { ...state, answers: { ...state.answers, [action.key]: action.isAnswered } }
    }
    if (!(action.key in state.answers)) return state
    return {
        ...state,
        answers: Object.fromEntries(Object.entries(state.answers).filter(([key]) => key !== action.key)),
    }
}

/** The slot a read draws: its own, or the skeleton while the view is gated. */
export const gatedSlot = (isGatedNow: boolean, slot: DataSlot<unknown>): DataSlot<unknown> =>
    isGatedNow ? { isLoading: true } : slot
