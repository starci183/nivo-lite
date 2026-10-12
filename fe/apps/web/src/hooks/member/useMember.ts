import { useContext } from "react"
import { MemberContext } from "./member.shared"
import type { ShellMember } from "./member.shared"

/** The signed-in member, or null outside the console layout. */
export const useMember = (): ShellMember | null => useContext(MemberContext)
