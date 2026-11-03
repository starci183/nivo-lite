"use client"

import { useFeatureReset } from "@/hooks/reuseables"
import type { HiringOwner } from "@/hooks/hiring"

import { useState, type Dispatch, type SetStateAction } from "react"
import { useHiringCopy, useHiringRun } from "@/hooks/hiring"
import type { HiringWorkbenchData, JobView } from "@/hooks/hiringWire"
import { useHiringJobCommands } from "./useHiringJobCommands"

/** The view `useHiringJobs` returns. */
export interface HiringJobsView {
    copiedId: string | null
    isPending: boolean
    error: string | null
    editing: "new" | JobView | null
    editorJob: JobView | null
    adJob: JobView | undefined
    create: () => void
    edit: (id: string) => void
    closeEditor: () => void
    openAd: Dispatch<SetStateAction<string | null>>
    closeAd: () => void
    copyLink: (id: string) => void
    transition: (id: string, to: string) => void
}

/** The jobs tab: the job being edited and the one whose ad is open, the status commands and the copied link. */
export const useHiringJobs = (data: HiringWorkbenchData, owner?: HiringOwner): HiringJobsView => {
    const run = useHiringRun(owner)
    const commands = useHiringJobCommands()
    const { copiedId, copy } = useHiringCopy(owner)
    const [editing, setEditing] = useState<JobView | "new" | null>(null)
    const [adJobId, setAdJobId] = useState<string | null>(null)
    const linkOf = (id: string): string => data.jobs.find((job) => job.id === id)?.publicUrl ?? ""
    useFeatureReset({
        isActive: owner?.isActive ?? true,
        isReady: true,
        scope: owner?.scope ?? "",
        onReset: () => {
            setEditing(null)
            setAdJobId(null)
        },
    })
    return {
        copiedId,
        isPending: run.isPending,
        error: run.error,
        editing,
        editorJob: editing === "new" ? null : editing,
        adJob: data.jobs.find((job) => job.id === adJobId),
        create: () => setEditing("new"),
        edit: (id: string) => setEditing(data.jobs.find((job) => job.id === id) ?? null),
        closeEditor: () => setEditing(null),
        openAd: setAdJobId,
        closeAd: () => setAdJobId(null),
        copyLink: (id: string) => copy(id, linkOf(id)),
        transition: (id: string, to: string) => run.dispatch(() => commands.setStatus(id, to)),
    }
}
