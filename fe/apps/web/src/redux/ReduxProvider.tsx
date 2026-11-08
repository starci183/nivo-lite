"use client"

import { useMemo, type ReactNode } from "react"
import { Provider } from "react-redux"
import { makeStore } from "./store"

/** What the redux provider wraps. */
interface ReduxProviderProps {
    readonly children: ReactNode
}

/** Creates one store per browser session (never shared between requests) and provides it to the tree. */
export const ReduxProvider = (props: ReduxProviderProps) => {
    const store = useMemo(() => makeStore(), [])
    return <Provider store={store}>{props.children}</Provider>
}
