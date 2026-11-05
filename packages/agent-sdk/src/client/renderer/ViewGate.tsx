"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from "react"
import type { ReactNode } from "react"
import { INITIAL_GATE, gateReducer, isGated, isSettled } from "./view-gate"

/** What a bound read reaches of the gate of its view. */
export interface ViewGateHandle {
    /** Whether the view still waits for a first answer from a read: every read then draws its skeleton. */
    readonly isGated: boolean
    /** Tells the gate whether the read at the address has answered once. */
    readonly report: (key: string, isAnswered: boolean) => void
    /** Tells the gate the read at the address is gone. */
    readonly forget: (key: string) => void
}

/** The gate of a read outside any view: never gated, hears nothing. */
const OPEN_GATE: ViewGateHandle = { isGated: false, report: () => undefined, forget: () => undefined }

const GateContext = createContext<ViewGateHandle>(OPEN_GATE)

/** The gate of the nearest view. */
export const useViewGate = (): ViewGateHandle => useContext(GateContext)

/** What the gate of a view takes. */
export interface ViewGateProps {
    readonly children: ReactNode
}

/**
 * The first load of a view: every bound read of the view shows its skeleton together until all of them have answered once; after
 * that the gate stays open and only the block whose variables changed reloads. Mount it with the id of the view as its key so a
 * view opened later gates on its own first load.
 */
export const ViewGate = (props: ViewGateProps): ReactNode => {
    const [state, dispatch] = useReducer(gateReducer, INITIAL_GATE)
    const report = useCallback((key: string, isAnswered: boolean) => dispatch({ kind: "report", key, isAnswered }), [])
    const forget = useCallback((key: string) => dispatch({ kind: "forget", key }), [])
    const gated = isGated(state)
    const settled = isSettled(state.answers)
    useEffect(() => {
        if (settled && !state.isOpened) dispatch({ kind: "open" })
    }, [settled, state.isOpened])
    const handle = useMemo(() => ({ isGated: gated, report, forget }), [gated, report, forget])
    return <GateContext.Provider value={handle}>{props.children}</GateContext.Provider>
}
