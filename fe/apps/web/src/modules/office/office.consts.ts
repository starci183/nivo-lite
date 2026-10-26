/** How often the approvals and the work items are read again, in milliseconds (the office-activity stream does not announce them). */
export const OFFICE_POLL_MS = 4000

/** How often the thread, the rooms, the unread counts and the markers are read again as a safety net behind the office-activity stream, in milliseconds. */
export const OFFICE_SAFETY_POLL_MS = 60_000

/** How many lines one page of the thread holds. */
export const OFFICE_PAGE_SIZE = 50

/** The author of the mirror line of a command sent from the Office. */
export const COMMAND_LINE_AUTHOR = "NIVO Bus"

/** The work items that wait for a person. */
export const OPEN_WORK_STATUSES: ReadonlyArray<string> = ["waiting_decision", "failed"]

/** The work items a person already decided. */
export const DECIDED_WORK_STATUSES: ReadonlyArray<string> = ["done", "rejected"]

/** How many open work items the thread reads. */
export const OPEN_WORK_LIMIT = 50

/** How many decided work items the thread reads. */
export const DECIDED_WORK_LIMIT = 40

/** How many decided exception cards stay in the thread as a record. */
export const DECIDED_CARDS_SHOWN = 12

/** How many recent customers the list shows. */
export const RECENT_CUSTOMERS = 5
