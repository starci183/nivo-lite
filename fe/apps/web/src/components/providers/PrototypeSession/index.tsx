"use client"

import type { ReactNode } from "react"
import { useWorkspaceId } from "@/hooks/workspaces"
import { fixtureSession } from "@/modules/fixture-api"
import { ConsoleSessionContext } from "@/modules/console-session"
import type { ConsoleSessionView } from "@/modules/types"

/** What the fixture session wraps. */
interface PrototypeSessionProps {
    readonly children: ReactNode
}

/** What the fixture session draws: the session and the subtree it serves. */
interface PrototypeSessionBaseProps {
    readonly session: ConsoleSessionView
    readonly content: ReactNode
}

/** Gives the console below it the fixture session. */
const PrototypeSessionBase = (props: PrototypeSessionBaseProps) => (
    <ConsoleSessionContext.Provider value={props.session}>{props.content}</ConsoleSessionContext.Provider>
)

/** The console session of a prototype build: the fixture owner in the workspace the address names, with no sign-in. */
export const PrototypeSession = (props: PrototypeSessionProps) => {
    const workspaceId = useWorkspaceId()
    return <PrototypeSessionBase session={fixtureSession(workspaceId)} content={props.children} />
}
