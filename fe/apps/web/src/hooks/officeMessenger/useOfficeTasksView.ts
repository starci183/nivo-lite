import { useState } from "react"
import type { OfficeTaskView, OfficeText } from "@/modules/types"

const ALL = "all"
const STATUS_KEYS = { open: "statusOpen", waiting_approval: "statusWaiting", done: "statusDone" } as const
const STATUSES = ["open", "waiting_approval", "done"] as const

type UseOfficeTasksViewResult = {
    view: {
        tasks: {
            statusLabel: string
            id: string
            title: string
            status: "open" | "waiting_approval" | "done"
            nextAction: string
            owner: string
            meta: string
            leadHref: string
        }[]
        hasTasks: boolean
        owner: string
        status: string
        ownerOptions: {
            id: string
            label: string
        }[]
        statusOptions: {
            id: string
            label: string
        }[]
        meta: string
        copy: {
            title: string
            noTasks: string
            noTasksHint: string
            openLeads: string
            noTasksMatch: string
            noTasksMatchHint: string
            clearFilters: string
            openArrow: string
            filterOwner: string
            filterStatus: string
        }
    }
    onOwner: (value: string) => void
    onStatus: (value: string) => void
    clear: () => void
}

/** Keeps the filters for the lifetime of the visible tasks pane and resolves its count and row copy. */
export const useOfficeTasksView = (
    tasks: ReadonlyArray<OfficeTaskView>,
    text: OfficeText,
    mounted: boolean,
): UseOfficeTasksViewResult => {
    const [state, setState] = useState({ mounted, owner: ALL, status: ALL })
    if (state.mounted !== mounted) setState({ mounted, owner: ALL, status: ALL })
    const owner = state.mounted === mounted ? state.owner : ALL
    const status = state.mounted === mounted ? state.status : ALL
    const visible = tasks.filter(
        (task) => (owner === ALL || task.owner === owner) && (status === ALL || task.status === status),
    )
    return {
        view: {
            tasks: visible.map((task) => ({ ...task, statusLabel: text(STATUS_KEYS[task.status]) })),
            hasTasks: tasks.length > 0,
            owner,
            status,
            ownerOptions: [
                { id: ALL, label: text("allOwners") },
                ...[...new Set(tasks.map((task) => task.owner))].map((name) => ({ id: name, label: name })),
            ],
            statusOptions: [
                { id: ALL, label: text("allStatuses") },
                ...STATUSES.map((key) => ({ id: key, label: text(STATUS_KEYS[key]) })),
            ],
            meta: text("tasksFact", { shown: visible.length, total: tasks.length }),
            copy: {
                title: text("tasksLabel"),
                noTasks: text("noTasks"),
                noTasksHint: text("noTasksHint"),
                openLeads: text("openLeads"),
                noTasksMatch: text("noTasksMatch"),
                noTasksMatchHint: text("noTasksMatchHint"),
                clearFilters: text("clearFilters"),
                openArrow: text("openArrow"),
                filterOwner: text("filterOwner"),
                filterStatus: text("filterStatus"),
            },
        },
        onOwner: (value: string): void => setState((current) => ({ ...current, owner: value })),
        onStatus: (value: string): void => setState((current) => ({ ...current, status: value })),
        clear: (): void => setState((current) => ({ ...current, owner: ALL, status: ALL })),
    }
}
