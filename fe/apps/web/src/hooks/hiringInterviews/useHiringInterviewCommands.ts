"use client"

import { useMemo } from "react"
import { useMutateSetHiringInterviewStatusSwr } from "@/hooks/swr"

/** The interview commands of the calendar through the back end GraphQL door. */
export const useHiringInterviewCommands = () => {
    const { trigger } = useMutateSetHiringInterviewStatusSwr()
    return useMemo(() => ({ setStatus: (id: string, status: string) => trigger({ id, status }) }), [trigger])
}
