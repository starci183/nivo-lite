import { useQueryWorkItemsSwr } from "@/hooks/swr"
import {
    DECIDED_CARDS_SHOWN,
    DECIDED_WORK_LIMIT,
    DECIDED_WORK_STATUSES,
    OFFICE_POLL_MS,
    OPEN_WORK_LIMIT,
    OPEN_WORK_STATUSES,
    toOfficeWork,
} from "@/modules/office"

const LIVE = { refreshInterval: OFFICE_POLL_MS }

/** The work items the thread shows as cards: the open ones, and the recently decided ones as a record. */
export const useOfficeWork = () => {
    const open = useQueryWorkItemsSwr({ statuses: [...OPEN_WORK_STATUSES], limit: OPEN_WORK_LIMIT }, LIVE)
    const done = useQueryWorkItemsSwr({ statuses: [...DECIDED_WORK_STATUSES], limit: DECIDED_WORK_LIMIT }, LIVE)
    return {
        exceptions: (open.data?.items.map(toOfficeWork) ?? [])
            .filter((work) => work.executionId === null)
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
        decidedCards: (done.data?.items.map(toOfficeWork) ?? [])
            .filter((work) => work.executionId === null && work.decidedPath === "human")
            .slice(0, DECIDED_CARDS_SHOWN),
    }
}
