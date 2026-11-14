"use client"

import { useMember } from "@/hooks/member"
import { useQueryProviderSandboxSwr } from "@/hooks/swr"
import type { SandboxGate } from "@/modules/types"

/** Which body the page draws and how to ask again. */
export interface SandboxGateState {
    readonly gate: SandboxGate
    readonly retry: () => void
}

/** Which body the page draws: the viewer's seat first (the back end refuses staff), then what the dev switch answers. */
export const useSandboxGate = (): SandboxGateState => {
    const member = useMember()
    const read = useQueryProviderSandboxSwr(member !== null && member.role !== "staff")
    const retry = (): void => void read.mutate()
    if (member === null) return { gate: "checking", retry }
    if (member.role === "staff") return { gate: "staff", retry }
    if (read.data !== undefined) return { gate: read.data.enabled ? "on" : "off", retry }
    return { gate: read.error === undefined ? "checking" : "failed", retry }
}
