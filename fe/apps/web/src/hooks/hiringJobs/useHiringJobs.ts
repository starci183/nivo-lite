import { useState } from "react"
import { useHiringCopy, useHiringRun } from "@/hooks/hiring"
import type { HiringWorkbenchData, JobView } from "@/hooks/hiringWire"
import { useHiringJobCommands } from "./useHiringJobCommands"

/** The jobs tab: the job being edited and the one whose ad is open, the status commands and the copied link. */
export const useHiringJobs = (data: HiringWorkbenchData) => {
    const run = useHiringRun()
    const commands = useHiringJobCommands()
    const { copiedId, copy } = useHiringCopy()
    const [editing, setEditing] = useState<JobView | "new" | null>(null)
    const [adJobId, setAdJobId] = useState<string | null>(null)
    const linkOf = (id: string): string => data.jobs.find((job) => job.id === id)?.publicUrl ?? ""
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
        copyLink: (id: string) => void copy(id, linkOf(id)),
        transition: (id: string, to: string) => void run.exec(() => commands.setStatus(id, to)),
    }
}
