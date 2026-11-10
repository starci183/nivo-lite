/** One key figure: its value, how it moved against the period before, and the words that say which period. */
export interface OverviewKpiView {
    readonly id: string
    readonly term: string
    readonly value: string
    /** The change and the period it is told against, already worded. */
    readonly meta: string
}

/** One bar of the chart. */
export interface OverviewBarView {
    readonly id: string
    readonly label: string
    readonly value: number
    readonly valueLabel: string
}

/** One step of the sales funnel. */
export interface OverviewFunnelStepView {
    readonly id: string
    readonly label: string
    /** The count, 0 up to `max`. */
    readonly value: number
    readonly max: number
    /** The count and its share of the first step, already worded. */
    readonly valueLabel: string
}

/** One channel customers come through. */
export interface OverviewChannelView {
    readonly id: string
    readonly label: string
    readonly leads: string
    readonly revenue: string
    /** The leads of this channel as a share of the most any channel has, 0..100. */
    readonly share: number
}

/** One item that waits for the owner. */
export interface OverviewApprovalView {
    readonly id: string
    readonly title: string
    readonly description: string
    /** The workbench path that opens the item, inside the workspace. */
    readonly href: string
}

/** One row of the hours-saved table of figures. */
export interface OverviewFactView {
    readonly id: string
    readonly term: string
    readonly value: string
}

/** What the agents did for the owner. */
export interface OverviewSavingsView {
    readonly hours: string
    /** The definition shown on hover beside the hours. */
    readonly definition: string
    readonly facts: ReadonlyArray<OverviewFactView>
}

/** One installed agent's row of the performance table. */
export interface OverviewAgentView {
    readonly id: string
    readonly name: string
    readonly handle: string
    readonly tasks: string
    readonly auto: string
    /** The share done alone as 0..100, or null when nothing was done. */
    readonly autoShare: number | null
    readonly waiting: string
    readonly errors: string
    readonly response: string
    readonly saved: string
    readonly credits: string
}

/** The whole overview, every figure already worded for the reader. */
export interface OverviewView {
    readonly kpis: ReadonlyArray<OverviewKpiView>
    readonly revenueBars: ReadonlyArray<OverviewBarView>
    readonly orderBars: ReadonlyArray<OverviewBarView>
    readonly funnel: ReadonlyArray<OverviewFunnelStepView>
    readonly channels: ReadonlyArray<OverviewChannelView>
    readonly approvals: {
        readonly count: number | null
        readonly items: ReadonlyArray<OverviewApprovalView>
        readonly hasMore: boolean
    }
    readonly savings: OverviewSavingsView
    readonly agents: ReadonlyArray<OverviewAgentView>
}
