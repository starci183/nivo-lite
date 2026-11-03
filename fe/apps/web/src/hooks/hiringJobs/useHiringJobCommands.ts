"use client"

import { useMemo } from "react"
import { useMutateGenerateHiringAdSwr, useMutateSetHiringJobStatusSwr } from "@/hooks/swr"

/** The view `useHiringJobCommands` returns. */
export interface HiringJobCommandsView {
    setStatus: (
        id: string,
        status: string,
    ) => Promise<{
        status: string
    }>
    generateAd: (jobId: string) => Promise<{
        attempts: number
        facebook: string
        generatedAt: string
        ms: number
        sanitised: boolean
        topcv: string
        zalo: string
    }>
}

/** The job commands of the Hiring workbench through the back end GraphQL door. */
export const useHiringJobCommands = (): HiringJobCommandsView => {
    const { trigger: statusTrigger } = useMutateSetHiringJobStatusSwr()
    const { trigger: adTrigger } = useMutateGenerateHiringAdSwr()
    return useMemo(
        () => ({
            setStatus: (id: string, status: string) => statusTrigger({ id, status }),
            generateAd: (jobId: string) => adTrigger({ jobId }),
        }),
        [statusTrigger, adTrigger],
    )
}
