import { useMemo } from "react"
import { useQueryPublicHiringInterviewSwr } from "@/hooks/swr"
import { toPublicInterview } from "./hiringPublic.shared"

/** The interview invitation of a link token, read without a session; `isMissing` when the link is not valid any more. */
export const usePublicHiringInterview = (token: string) => {
    const read = useQueryPublicHiringInterviewSwr({ token })
    const view = useMemo(() => (read.data === undefined ? undefined : toPublicInterview(read.data)), [read.data])
    return { view, isLoading: read.isLoading, isMissing: read.error !== undefined }
}
