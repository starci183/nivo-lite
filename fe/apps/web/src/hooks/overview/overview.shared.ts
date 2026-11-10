import type { OverviewData } from "./overview.view"

/** The seven days the chart draws while the first read is in flight: the skeleton keeps the geometry of the ready chart. */
const PLACEHOLDER_DAYS = [
    "2026-01-01",
    "2026-01-02",
    "2026-01-03",
    "2026-01-04",
    "2026-01-05",
    "2026-01-06",
    "2026-01-07",
]

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
    revenue: { current: 0, previous: 0 },
    orders: { current: 0, previous: 0 },
    newCustomers: { current: 0, previous: 0 },
    closeRate: { current: 0, previous: 0 },
    agentAutoRate: { current: 0, previous: 0 },
    days: PLACEHOLDER_DAYS.map((day, index) => ({ day, revenueVnd: (index + 1) * 1000, orders: index + 1 })),
    funnel: { visitors: 4, consulted: 3, ordered: 2, paid: 1 },
    channels: [
        { channel: "website", leads: 3, revenueVnd: 0 },
        { channel: "zalo", leads: 2, revenueVnd: 0 },
    ],
    approvals: { total: 3, items: [placeholderApproval("a"), placeholderApproval("b"), placeholderApproval("c")] },
    savings: {
        minutesSaved: 0,
        lines: [],
        defaultMinutes: 0,
        messagesAnswered: 0,
        ordersCreated: 0,
        paymentsMatched: 0,
        creditsUsed: 0,
        creditsLimit: null,
    },
    agents: [placeholderAgent("a"), placeholderAgent("b")],
}
