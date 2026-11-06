/** The two views of the Work tab: the work itself, and the runs of the agent. */
export type AgentWorkViewKey = "work" | "runs"

/** The query words that mean the runs view: the view itself, the run chosen in it, and its status filter. */
const RUNS_PARAMS = ["run", "status"] as const

/** The view a URL opens: the runs when it names the view, a run or a status filter (a link to a run lands there), else the work. */
export const agentWorkViewOf = (get: (name: string) => string | null | undefined): AgentWorkViewKey => {
    if (get("view") === "runs") return "runs"
    return RUNS_PARAMS.some((name) => (get(name) ?? "") !== "") ? "runs" : "work"
}

/** The query of a view: the runs view names itself; the work view carries nothing, so no run or filter stays behind. */
export const agentWorkViewQuery = (view: AgentWorkViewKey): string => (view === "runs" ? "view=runs" : "")
