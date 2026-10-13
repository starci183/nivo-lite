import { useMemo } from "react"
import { useQueryPublicHiringJobSwr } from "@/hooks/swr"
import { toPublicJob } from "./hiringPublic.shared"

/** The public job of a workspace slug and a job slug, read without a session; `isMissing` when the back end knows no such job. */
export const usePublicHiringJob = (ws: string, job: string) => {
    const read = useQueryPublicHiringJobSwr({ ws, job })
    const view = useMemo(() => (read.data === undefined ? undefined : toPublicJob(read.data)), [read.data])
    return { view, isLoading: read.isLoading, isMissing: read.error !== undefined }
}
