import type { OverviewData } from "@/modules/overview"

/** The instant a placeholder line was raised: no reader sees it, the line is a skeleton. */
const PLACEHOLDER_AT = "2026-01-01T00:00:00.000Z"

/** A waiting item of the placeholder. */
const placeholderApproval = (id: string): OverviewData["approvals"]["items"][number] => ({
    id,
    agentName: "-",
    action: "-",
    summary: "-",
    customer: null,
    createdAt: PLACEHOLDER_AT,
    href: "",
})

/** An agent row of the placeholder. */
const placeholderAgent = (id: string): OverviewData["agents"][number] => ({
    agentId: id,
    name: "-",
    handle: "-",
    module: "-",
    tasksDone: 0,
    autoRate: 0,
    waiting: 0,
    errors: 0,
    medianResponseSeconds: null,
    minutesSaved: 0,
    credits: 0,
})

/** Figures of the same shape as a read, drawn under a shimmer while the first read loads. */
export const PLACEHOLDER_OVERVIEW: OverviewData = {
    period: "last_7_days",
    from: PLACEHOLDER_AT,
    to: "2026-01-08T00:00:00.000Z",
    conversations: { current: 0, previous: 0 },
    newContacts: { current: 0, previous: 0 },
    runsDone: { current: 0, previous: 0 },
    runsFailed: { current: 0, previous: 0 },
    approvals: { total: 3, items: [placeholderApproval("a"), placeholderApproval("b"), placeholderApproval("c")] },
    savings: {
        minutesSaved: 0,
        lines: [],
        defaultMinutes: 0,
        messagesAnswered: 0,
        creditsUsed: 0,
        creditsLimit: null,
    },
    agents: [placeholderAgent("a"), placeholderAgent("b")],
}
