/** One figure of the strip. */
interface FiguresFigureView {
    readonly id: string
    readonly term: string
    readonly value: string
    /** The unit shown after the value, or empty. */
    readonly unit: string
    readonly meta: string
}

/** The status badge of the schedule in view. */
interface WeekBarWeekBarStatusView {
    readonly tone: "neutral" | "warning" | "success"
    readonly label: string
}

/** One figure of the week. */
interface WeekStatsWeekStatView {
    readonly id: string
    readonly term: string
    readonly value: string
    readonly meta: string
    /** The figure needs a look: it is drawn as a danger dot. */
    readonly isAlert: boolean
}

/** How a coverage block stands against its minimum and ideal. */
type CoverageCoverageTone = "negative" | "cautionary" | "affirmative"

/** One coverage block of one day. */
interface CoverageCoverageMeterView {
    readonly id: string
    readonly label: string
    readonly value: number
    readonly max: number
    readonly reading: string
    readonly tone: CoverageCoverageTone
}

/** One day of the week with its coverage blocks. */
interface CoverageCoverageDayView {
    readonly id: string
    readonly label: string
    readonly meters: ReadonlyArray<CoverageCoverageMeterView>
}

/** One shift as a chip of the grid or a line of the day list. */
interface GridGridChipView {
    readonly id: string
    readonly time: string
    readonly position: string
    /** The colour of the position, drawn on the leading edge. */
    readonly color: string
    /** The rules this shift breaks, worded; empty when none. */
    readonly why: string
    readonly isOpen: boolean
    readonly isPicked: boolean
}

/** One cell of the grid: a person on a date. */
interface GridGridCellView {
    readonly id: string
    readonly date: string
    readonly chips: ReadonlyArray<GridGridChipView>
    /** A picked shift of this date can be dropped here. */
    readonly canDrop: boolean
    readonly isTarget: boolean
    readonly isOff: boolean
}

/** One person (or the open-shift row) of the grid. */
interface GridGridRowView {
    readonly id: string
    readonly name: string
    readonly sub: string
    readonly cells: ReadonlyArray<GridGridCellView>
}

/** One shift of the selected day with the person it is given to. */
interface GridGridDayShiftView extends GridGridChipView {
    readonly staffId: string
    readonly staffName: string
}

/** Actual resolved week drawings, shared by the world controller and pure ready anatomy. */
export interface ShiftsWeekViews {
    readonly weekReady: {
        readonly isVisible: boolean
        readonly weekBar: ShiftsWeekViews["weekBarData"] | undefined
        readonly weekStats: ShiftsWeekViews["weekStatsData"] | undefined
        readonly coverage: ShiftsWeekViews["coverageData"] | undefined
        readonly grid: ShiftsWeekViews["gridData"] | undefined
    }
    readonly weekCopy: {
        readonly weekBar: ShiftsWeekViews["weekBarCopy"]
        readonly weekStats: ShiftsWeekViews["weekStatsCopy"]
        readonly coverage: ShiftsWeekViews["coverageCopy"]
        readonly grid: ShiftsWeekViews["gridCopy"]
    }

    readonly figuresData: { readonly isVisible: boolean } & Pick<ShiftsWeekViews["figures"], "staffNotice" | "stats">
    readonly figuresCopy: Omit<ShiftsWeekViews["figures"], "staffNotice" | "stats">

    readonly weekBarData: Pick<
        ShiftsWeekViews["weekBar"],
        "weekLabel" | "status" | "isDraft" | "canPublish" | "empty" | "waiting"
    >
    readonly weekBarCopy: Omit<
        ShiftsWeekViews["weekBar"],
        "weekLabel" | "status" | "isDraft" | "canPublish" | "empty" | "waiting"
    >

    readonly weekStatsData: Pick<
        ShiftsWeekViews["weekStats"],
        "ariaLabel" | "stats" | "lines" | "source" | "hasExplanation"
    >
    readonly weekStatsCopy: Omit<
        ShiftsWeekViews["weekStats"],
        "ariaLabel" | "stats" | "lines" | "source" | "hasExplanation"
    >

    readonly coverageData: Pick<ShiftsWeekViews["coverage"], "days">
    readonly coverageCopy: Omit<ShiftsWeekViews["coverage"], "days">

    readonly gridData: Pick<
        ShiftsWeekViews["grid"],
        "hint" | "editable" | "dates" | "rows" | "selectedDay" | "dayShifts" | "assignOptions"
    >
    readonly gridCopy: Omit<
        ShiftsWeekViews["grid"],
        "hint" | "editable" | "dates" | "rows" | "selectedDay" | "dayShifts" | "assignOptions"
    >

    readonly figures: {
        readonly captions: ReadonlyArray<{ readonly id: string; readonly term: string; readonly unit: string }>
        readonly ariaLabel: string
        /** Set for staff: the strip is replaced by this pointer to their own schedule. */
        readonly staffNotice: string | null
        readonly stats: ReadonlyArray<FiguresFigureView>
    }
    readonly figuresFigureView: FiguresFigureView
    readonly weekBar: {
        readonly weekLabel: string
        readonly status: WeekBarWeekBarStatusView
        readonly prevLabel: string
        readonly nextLabel: string
        readonly todayLabel: string
        readonly proposeLabel: string
        readonly publishLabel: string
        /** What the back end is busy with, or an empty line. */
        readonly progress: string
        readonly isDraft: boolean
        readonly canPublish: boolean
        readonly isProposing: boolean
        readonly isPublishing: boolean
        readonly isDeciding: boolean
        /** Nothing is running, so every button can be pressed. */
        readonly isIdle: boolean
        /** Shown under the bar while the week has no schedule. */
        readonly empty: { readonly title: string; readonly body: string } | null
        /** The publish request waiting for the owner, or `null`. */
        readonly waiting: {
            readonly title: string
            readonly description: string
            readonly approveLabel: string
            readonly declineLabel: string
        } | null
    }
    readonly weekBarWeekBarStatusView: WeekBarWeekBarStatusView
    readonly weekStats: {
        readonly captions: ReadonlyArray<{ readonly id: string; readonly term: string; readonly meta: string }>
        readonly ariaLabel: string
        readonly stats: ReadonlyArray<WeekStatsWeekStatView>
        readonly explainTitle: string
        readonly explainNone: string
        readonly lines: ReadonlyArray<{ readonly id: string; readonly text: string }>
        /** Who wrote the explanation, or `null` when there is none yet. */
        readonly source: { readonly label: string; readonly isOpenClaw: boolean } | null
        /** The explanation card is shown (there is a text, or the draft is waiting for one). */
        readonly hasExplanation: boolean
    }
    readonly weekStatsWeekStatView: WeekStatsWeekStatView
    readonly coverage: {
        readonly dayLabels: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly title: string
        readonly hint: string
        readonly days: ReadonlyArray<CoverageCoverageDayView>
    }
    readonly coverageCoverageTone: CoverageCoverageTone
    readonly coverageCoverageMeterView: CoverageCoverageMeterView
    readonly coverageCoverageDayView: CoverageCoverageDayView
    readonly grid: {
        readonly dayLabels: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly title: string
        readonly hint: string
        readonly emptyDay: string
        readonly assignLabel: string
        readonly onLeaveLabel: string
        /** The id that stands for "nobody" in the rows and the assign select. */
        readonly openId: string
        readonly editable: boolean
        readonly dates: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly rows: ReadonlyArray<GridGridRowView>
        readonly selectedDay: string
        readonly dayShifts: ReadonlyArray<GridGridDayShiftView>
        /** The people a shift can be given to, led by the open choice. */
        readonly assignOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
    }
    readonly gridGridChipView: GridGridChipView
    readonly gridGridCellView: GridGridCellView
    readonly gridGridRowView: GridGridRowView
    readonly gridGridDayShiftView: GridGridDayShiftView
}

/** Commands stay separate from the resolved week data contract. */
export interface ShiftsWeekActions {
    readonly figures: Record<string, never>
    readonly weekBar: {
        readonly previous: () => void
        readonly next: () => void
        readonly today: () => void
        readonly propose: () => void
        readonly publish: () => void
        readonly approve: () => void
        readonly decline: () => void
    }
    readonly weekStats: Record<string, never>
    readonly coverage: Record<string, never>
    readonly grid: {
        readonly pick: (shiftId: string) => void
        readonly dragStart: (shiftId: string) => void
        readonly dragEnd: () => void
        readonly hover: (cellId: string | null) => void
        readonly drop: (shiftId: string, rowId: string) => void
        readonly place: (rowId: string) => void
        readonly day: (date: string) => void
        readonly assign: (shiftId: string, rowId: string) => void
    }
}
