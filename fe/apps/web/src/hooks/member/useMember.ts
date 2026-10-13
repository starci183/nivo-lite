import { useConsoleSession } from "@/hooks/console"
import type { ShellMember } from "./member.shared"

/** The signed-in member of the console session, or null outside the console (or before the session is read). */
export const useMember = (): ShellMember | null => useConsoleSession()?.member ?? null
