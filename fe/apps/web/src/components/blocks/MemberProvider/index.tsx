"use client"

import type { ReactNode } from "react"
import { MemberContext } from "@/hooks/member"
import type { ShellMember } from "@/hooks/member"

/** What the console layout hands the provider. */
type MemberProviderProps = {
    readonly member: ShellMember | null
    readonly children: ReactNode
}

/** Provides the signed-in member to every client screen under the console layout. */
export const MemberProvider = (props: MemberProviderProps) => (
    <MemberContext.Provider value={props.member}>{props.children}</MemberContext.Provider>
)
