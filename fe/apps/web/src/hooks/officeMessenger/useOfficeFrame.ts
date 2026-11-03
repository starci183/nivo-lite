"use client"

import { useCallback, useReducer, useSyncExternalStore } from "react"
import { arrangementOf } from "@/modules/office"

import type { Arrangement } from "@/modules/types"

const WIDE_INFO_QUERY = "(min-width: 80rem)"
const SIDE_BY_SIDE_QUERY = "(min-width: 48rem)"

const subscribeWide = (notify: () => void): (() => void) => {
    const query = window.matchMedia(WIDE_INFO_QUERY)
    query.addEventListener("change", notify)
    return () => query.removeEventListener("change", notify)
}

const readWide = (): boolean => window.matchMedia(WIDE_INFO_QUERY).matches

const readWideOnServer = (): boolean => false

const subscribeSideBySide = (notify: () => void): (() => void) => {
    const query = window.matchMedia(SIDE_BY_SIDE_QUERY)
    query.addEventListener("change", notify)
    return () => query.removeEventListener("change", notify)
}

const readSideBySide = (): boolean => window.matchMedia(SIDE_BY_SIDE_QUERY).matches

/** The columns of the messenger: which one a phone shows, the centre view, and the info panel an owner opened or closed by hand. */
interface FrameState {
    readonly phoneView: "list" | "thread"
    readonly centre: "chat" | "tasks"
    /** The owner's choice for the info panel; null follows the screen (open when wide). */
    readonly info: boolean | null
}

type FrameAction =
    | { readonly type: "thread" }
    | { readonly type: "list" }
    | { readonly type: "tasks" }
    | { readonly type: "chat" }
    | { readonly type: "info"; readonly isOpen: boolean | null }

const reduce = (state: FrameState, action: FrameAction): FrameState => {
    if (action.type === "thread") return { phoneView: "thread", centre: "chat", info: state.info }
    if (action.type === "list") return { ...state, phoneView: "list" }
    if (action.type === "tasks") return { ...state, phoneView: "thread", centre: "tasks" }
    if (action.type === "chat") return { ...state, centre: "chat" }
    return { ...state, info: action.isOpen }
}

type UseOfficeFrameResult = {
    phoneView: "list" | "thread"
    centre: "chat" | "tasks"
    isThreadVisible: boolean
    isInfoDocked: boolean
    isSideBySide: boolean
    isInfoOpen: boolean
    arrangement: Arrangement
    showThread: () => void
    showList: () => void
    showTasks: () => void
    showChat: () => void
    setInfoOpen: (isOpen: boolean) => void
    toggleInfo: () => void
}

/** The frame of the Office messenger: wide screens dock the info panel as a column, narrower ones open it in a drawer. */
export const useOfficeFrame = (): UseOfficeFrameResult => {
    const [state, dispatch] = useReducer(reduce, { phoneView: "list", centre: "chat", info: null })
    const isInfoDocked = useSyncExternalStore(subscribeWide, readWide, readWideOnServer)
    const isSideBySide = useSyncExternalStore(subscribeSideBySide, readSideBySide, readWideOnServer)
    const isInfoOpen = state.info ?? isInfoDocked
    return {
        phoneView: state.phoneView,
        centre: state.centre,
        isThreadVisible: state.centre === "chat" && (isSideBySide || state.phoneView === "thread"),
        isInfoDocked,
        isSideBySide,
        isInfoOpen,
        arrangement: arrangementOf({
            phoneView: state.phoneView,
            centre: state.centre,
            isInfoOpen,
            isCompact: !isSideBySide,
        }),
        showThread: useCallback((): void => dispatch({ type: "thread" }), []),
        showList: useCallback((): void => dispatch({ type: "list" }), []),
        showTasks: useCallback((): void => dispatch({ type: "tasks" }), []),
        showChat: useCallback((): void => dispatch({ type: "chat" }), []),
        setInfoOpen: useCallback((isOpen: boolean): void => dispatch({ type: "info", isOpen }), []),
        toggleInfo: useCallback((): void => dispatch({ type: "info", isOpen: !isInfoOpen }), [isInfoOpen]),
    }
}
