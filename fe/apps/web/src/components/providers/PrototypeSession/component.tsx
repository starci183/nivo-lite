import type { ReactNode } from "react"
import { ConsoleSessionContext } from "@/modules/console-session"
import type { ConsoleSessionView } from "@/modules/types"

/** What the fixture session draws: the session and the subtree it serves. */
export interface PrototypeSessionBaseProps {
    readonly session: ConsoleSessionView
    readonly content: ReactNode
}

/** Gives the console below it the fixture session. */
export const PrototypeSessionBase = (props: PrototypeSessionBaseProps) => (
    <ConsoleSessionContext.Provider value={props.session}>{props.content}</ConsoleSessionContext.Provider>
)
