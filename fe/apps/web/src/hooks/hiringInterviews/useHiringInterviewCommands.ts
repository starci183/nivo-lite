"use client"

import { useMemo } from "react"
import { useMutateSetHiringInterviewStatusSwr } from "@/hooks/swr"

/** The view `useHiringInterviewCommands` returns. */
export interface HiringInterviewCommandsView {
    setStatus: (id: string, status: string) => Promise<boolean>
}

/** The interview commands of the calendar through the back end GraphQL door. */
export const useHiringInterviewCommands = (): HiringInterviewCommandsView => {
    const { trigger } = useMutateSetHiringInterviewStatusSwr()
    return useMemo(() => ({ setStatus: (id: string, status: string) => trigger({ id, status }) }), [trigger])
}
