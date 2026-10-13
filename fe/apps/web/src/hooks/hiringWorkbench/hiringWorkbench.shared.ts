import { HIRING_TAB_IDS } from "@/hooks/hiring"
import type { HiringWorkbenchData } from "@/hooks/hiringWire"

/** The tab a `?tab=` names; anything else opens the jobs tab. */
export const resolveTab = (tab: string | null): string =>
    HIRING_TAB_IDS.find((id) => id === tab) ?? HIRING_TAB_IDS[0] ?? "jobs"

/** The candidate a record id (`?focus=`) leads to: a candidate, or an offer or interview of one, or the work item behind them. */
export const focusedCandidateId = (data: HiringWorkbenchData, focus: string | null): string | null => {
    if (focus === null) return null
    if (data.candidates.some((candidate) => candidate.id === focus)) return focus
    const offer = data.offers.find((entry) => entry.id === focus || entry.workItemId === focus)
    if (offer !== undefined) return offer.candidateId
    const interview = data.interviews.find((entry) => entry.id === focus || entry.workItemId === focus)
    return interview?.candidateId ?? null
}

/** The counts shown beside the tab names: new candidates, upcoming interviews, offers waiting, hired people. */
export const tabCounts = (data: HiringWorkbenchData): Readonly<Record<string, number>> => {
    const now = Date.parse(data.nowIso)
    return {
        candidates: data.candidates.filter((candidate) => candidate.stage === "applied").length,
        interviews: data.interviews.filter(
            (interview) =>
                interview.status === "confirmed" &&
                interview.slotStart !== null &&
                Date.parse(interview.slotStart) >= now,
        ).length,
        offers: data.offers.filter((offer) => offer.status === "waiting").length,
        onboarding: data.candidates.filter((candidate) => candidate.stage === "hired").length,
    }
}
