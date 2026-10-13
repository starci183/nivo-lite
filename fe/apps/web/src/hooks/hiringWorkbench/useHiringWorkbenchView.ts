import { useState } from "react"
import { useHiringWorkbench } from "@/hooks/hiring"
import { ALL_JOBS } from "@/hooks/hiringPipeline"
import { focusedCandidateId, resolveTab } from "./hiringWorkbench.shared"

/**
 * The Hiring workbench screen: the board read, the tab (from `?tab=`), the job the candidates tab filters on and the candidate whose
 * drawer is open (the one `?focus=` leads to until somebody opens another or closes it). `openAndShow` is for the other tabs, which
 * jump to the candidate in the candidates tab.
 */
export const useHiringWorkbenchView = (initialTab: string | null, focus: string | null) => {
    const bench = useHiringWorkbench()
    const [tab, setTab] = useState(resolveTab(initialTab))
    const [jobId, setJobId] = useState(ALL_JOBS)
    const [chosenId, setChosenId] = useState<string | null | undefined>(undefined)
    const focusedId = bench.data === undefined ? null : focusedCandidateId(bench.data, focus)
    const openId = chosenId === undefined ? focusedId : chosenId
    return {
        ...bench,
        tab,
        jobId,
        opened: bench.data?.candidates.find((candidate) => candidate.id === openId),
        setTab: (id: string) => setTab(resolveTab(id)),
        openPipeline: (id: string) => {
            setJobId(id)
            setTab("candidates")
        },
        setJobId,
        open: setChosenId,
        openAndShow: (id: string) => {
            setChosenId(id)
            setTab("candidates")
        },
        close: () => setChosenId(null),
    }
}
