"use client"

import { useMemo } from "react"
import { useQueryPublicHiringJobSwr } from "@/hooks/swr"
import { toPublicJob, type PublicJobView } from "./hiringPublic.shared"

/** The view `usePublicHiringJob` returns. */
export interface PublicHiringJobView {
    view: PublicJobView | undefined
    isLoading: boolean
    isMissing: boolean
    reload: () => void
}

/** The public job of a workspace slug and a job slug, read without a session; `isMissing` when the back end knows no such job. */
export const usePublicHiringJob = (ws: string, job: string): PublicHiringJobView => {
    const read = useQueryPublicHiringJobSwr({ ws, job })
    const view = useMemo(() => (read.data === undefined ? undefined : toPublicJob(read.data)), [read.data])
    return {
        view,
        isLoading: read.isLoading,
        isMissing: read.error !== undefined,
        reload: () => {
            void read.mutate()
        },
    }
}
