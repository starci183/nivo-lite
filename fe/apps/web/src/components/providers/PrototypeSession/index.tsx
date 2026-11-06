"use client"

import type { ReactNode } from "react"
import { useWorkspaceId } from "@/hooks/workspaces"
import { fixtureSession } from "@/modules/fixture-api"
import { PrototypeSessionBase } from "./component"

/** What the fixture session wraps. */
interface PrototypeSessionProps {
    readonly children: ReactNode
}

/** The console session of a prototype build: the fixture owner in the workspace the address names, with no sign-in. */
export const PrototypeSession = (props: PrototypeSessionProps) => {
    const workspaceId = useWorkspaceId()
    return <PrototypeSessionBase session={fixtureSession(workspaceId)} content={props.children} />
}
