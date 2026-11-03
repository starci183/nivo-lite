"use client"

import { useMemo } from "react"
import { useQueryPublicHiringInterviewSwr } from "@/hooks/swr"
import { toPublicInterview, type PublicInterviewView } from "./hiringPublic.shared"

/** The view `usePublicHiringInterview` returns. */
export interface PublicHiringInterviewView {
    view: PublicInterviewView | undefined
    isLoading: boolean
    isMissing: boolean
    reload: () => void
}

/** The interview invitation of a link token, read without a session; `isMissing` when the link is not valid any more. */
export const usePublicHiringInterview = (token: string): PublicHiringInterviewView => {
    const read = useQueryPublicHiringInterviewSwr({ token })
    const view = useMemo(() => (read.data === undefined ? undefined : toPublicInterview(read.data)), [read.data])
    return {
        view,
        isLoading: read.isLoading,
        isMissing: read.error !== undefined,
        reload: () => {
            void read.mutate()
        },
    }
}
