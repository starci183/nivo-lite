import { useState, type ComponentProps, type ReactNode } from "react"
import { Badge, Pane, PaneGrid, PaneHeader, PaneSection, SurfaceCard } from "@starci/grammar/common"
import type { ParamHandle, ReadDefinition } from "../../block/block.types"
import { wordsOf } from "../../schema/namespaced"
import type { PlanNode } from "../../spec/render-plan"
import type { SpecAsideSummary } from "../../spec/spec.types"
import { resolveVariables, textOf, valueAt } from "../../spec/spec-value"
import { AsideHeadProvider, type AsideHead } from "./aside-head"
import { isOpenedBySelection } from "./show-when"
import { useIsNarrow } from "./useIsNarrow"
import { useWorkbenchHost } from "../host/WorkbenchHostProvider"

/** The tracks of the grid, by breakpoint. */
type GridTracks = NonNullable<ComponentProps<typeof PaneGrid>["rows"]>

/** What the head slot of a Pane takes. */
type PaneHeadSlot = NonNullable<ComponentProps<typeof Pane>["head"]>

/** What the aside summary reads: how much waits, and what is first. */
interface SummaryFigures {
    /** The figure the read gives at the summary's path; empty while unknown. */
    readonly count: string
    /** The text of the first item; empty while unknown or when the summary names none. */
    readonly preview: string
    /** Whether the read answered and nothing waits (no figure, or zero): the aside would hold only its empty notice. */
    readonly isEmpty: boolean
}

const UNKNOWN: SummaryFigures = { count: "", preview: "", isEmpty: false }

/** Whether the figure a ready read gave at the summary's path says that nothing waits: absent, or zero. */
const isNothing = (figure: unknown): boolean =>
    figure === null || figure === undefined || figure === 0 || figure === "0"

/** What the read of the summary takes. */
interface SummaryReadProps {
    readonly summary: SpecAsideSummary | null
    readonly reads: ReadonlyArray<ReadDefinition>
    readonly installationId: string
    readonly params: ParamHandle
    readonly children: (figures: SummaryFigures) => ReactNode
}

/** The read of the summary under the viewer rights: it never runs without its permission or while a param it needs has no value. */
const SummaryRead = (props: SummaryReadProps): ReactNode => {
    const host = useWorkbenchHost()
    const summary = props.summary
    const read = summary === null ? undefined : props.reads.find((candidate) => candidate.id === summary.read)
    const isAllowed = host.useCan(read?.permission ?? null)
    const resolved = resolveVariables(summary?.variables, props.installationId, props.params.value)
    const isActive = read !== undefined && isAllowed && resolved.pending.length === 0
    const answer = host.useRead(read?.operation ?? "", isActive ? resolved.variables : null)
    if (summary === null || !isActive || answer.status !== "ready") return props.children(UNKNOWN)
    const figure = valueAt(answer.data, summary.path)
    return props.children({
        isEmpty: isNothing(figure),
        count: textOf(figure),
        preview: summary.previewPath === undefined ? "" : textOf(valueAt(answer.data, summary.previewPath)),
    })
}

/** What the aside takes when it is a block of the well. */
interface NarrowAsideProps {
    readonly label: string
    readonly count: string
    /** Whether the aside is a titled card; otherwise its blocks carry their own headings. */
    readonly hasTitle: boolean
    readonly children: ReactNode
}

/** The aside content on a narrow screen: a titled card with the count, or the bare blocks. */
const NarrowAside = (props: NarrowAsideProps): ReactNode => {
    const fact = props.count === "" ? {} : { fact: props.count }
    return props.hasTitle ? (
        <SurfaceCard label={props.label} headingLevel={2} {...fact}>
            {props.children}
        </SurfaceCard>
    ) : (
        props.children
    )
}

/** The head of the aside pane as the Grammar takes it: the title, the muted line, and the close button when the block gave both its action and its name. */
const paneHeadOf = (head: AsideHead): PaneHeadSlot => ({
    title: head.title,
    ...(head.description === undefined ? {} : { description: head.description }),
    ...(head.onClose === undefined || head.closeLabel === undefined
        ? {}
        : { onClose: head.onClose, closeLabel: head.closeLabel }),
})

/** What the panes take. */
interface AsidePanesProps {
    readonly namespace: string
    /** The tabs band of the page, drawn on top of the main pane on the white ground of the chrome; null when the host draws the tabs in its header. */
    readonly tabs: ReactNode
    /** The main pane: the well, where the blocks of the view float. */
    readonly main: ReactNode
    /** The aside pane. */
    readonly aside: ReactNode
    /** The label of the aside pane and its title. */
    readonly label: string
    /** How much waits in the aside; empty while unknown. */
    readonly count: string
    /** Whether the read answered that nothing waits: the aside is not drawn and its column collapses. */
    readonly isEmpty: boolean
    /** Whether the aside is a title over its content: a spec with no summary names none, and its blocks carry their own headings. */
    readonly hasTitle: boolean
    /** Whether the screen is narrower than the wide layout: the aside is then a block of the well. */
    readonly isNarrow: boolean
    /** Whether the main pane is a grid of panes of its own (a master-detail view): the grid takes the pane full-bleed and the panes scroll themselves. */
    readonly isPanes: boolean
    /** The sticky head a block of the aside asked for; null draws the title of the summary, if any. */
    readonly head: AsideHead | null
    /** Whether a record is chosen: its detail then stands first on a phone; the default aside stands after the main pane. */
    readonly isChosen: boolean
}

/** What the main pane is given by whether its content is a grid of panes of its own: that grid is held full-bleed, anything else floats in the well. */
const PANES_PANE: Readonly<Record<string, { readonly inset?: "flush"; readonly content?: "full" }>> = {
    true: { inset: "flush", content: "full" },
    false: {},
}

/** The areas, columns and rows of the grid, by whether the tabs band and the aside stand in it: a grid without an aside has no aside column. */
interface GridShape {
    readonly areas: NonNullable<ComponentProps<typeof PaneGrid>["areas"]>
    readonly columns: GridTracks
    readonly rows: GridTracks
}

const SHAPES = {
    "true-true": {
        areas: { base: ["tabs", "aside", "main"], wide: ["tabs aside", "main aside"] },
        columns: { base: ["fill"], wide: ["fill", "wide"] },
        rows: { base: ["auto", "auto", "fill"], wide: ["auto", "fill"] },
    },
    "false-true": {
        areas: { base: ["aside", "main"], wide: ["main aside"] },
        columns: { base: ["fill"], wide: ["fill", "wide"] },
        rows: { base: ["auto", "fill"], wide: ["fill"] },
    },
    "true-false": {
        areas: { base: ["tabs", "main"], wide: ["tabs", "main"] },
        columns: { base: ["fill"], wide: ["fill"] },
        rows: { base: ["auto", "fill"], wide: ["auto", "fill"] },
    },
    "false-false": {
        areas: { base: ["main"], wide: ["main"] },
        columns: { base: ["fill"], wide: ["fill"] },
        rows: { base: ["fill"], wide: ["fill"] },
    },
} satisfies Record<string, GridShape>

const gridOf = (hasTabs: boolean, hasAside: boolean, isAsideFirst: boolean): GridShape => {
    if (hasTabs && hasAside && !isAsideFirst)
        return { ...SHAPES["true-true"], areas: { ...SHAPES["true-true"].areas, base: ["tabs", "main", "aside"] } }
    if (!hasTabs && hasAside && !isAsideFirst)
        return { ...SHAPES["false-true"], areas: { ...SHAPES["false-true"].areas, base: ["main", "aside"] } }
    if (hasTabs) return hasAside ? SHAPES["true-true"] : SHAPES["true-false"]
    return hasAside ? SHAPES["false-true"] : SHAPES["false-false"]
}

/**
 * The view body of a spec that has an aside, in the depth of the app: the tabs band and the aside are chrome on the white surface (the
 * aside runs the whole height at the end, with a divider on its start edge), and only the main pane is the well, where the blocks float.
 * Below the wide breakpoint there is no aside column: its content is the first block of the well, under the tabs.
 */
const AsidePanes = (props: AsidePanesProps): ReactNode => {
    const hasTabs = props.tabs !== null
    /** A summary that reads zero means nothing waits: the aside would hold only its empty notice, so it is not drawn and its column collapses. */
    const hasAside = !props.isEmpty
    const grid = gridOf(hasTabs, hasAside, props.isChosen)
    const mainBody = props.isPanes ? props.main : <PaneSection>{props.main}</PaneSection>
    const asideHead = props.head === null ? {} : { head: paneHeadOf(props.head) }
    const countStatus = props.count === "" ? {} : { status: <Badge tone="accent">{props.count}</Badge> }
    return (
        <PaneGrid label={props.label} areas={grid.areas} columns={grid.columns} rows={grid.rows}>
            {hasTabs ? (
                <Pane area="tabs" surface>
                    <PaneSection align="center">{props.tabs}</PaneSection>
                </Pane>
            ) : null}
            <Pane area="main" label={props.namespace} {...PANES_PANE[String(props.isPanes)]}>
                {mainBody}
            </Pane>
            {hasAside && props.isNarrow ? (
                <Pane area="aside" label={props.label}>
                    <PaneSection>
                        <NarrowAside label={props.label} count={props.count} hasTitle={props.hasTitle}>
                            {props.aside}
                        </NarrowAside>
                    </PaneSection>
                </Pane>
            ) : null}
            {hasAside && !props.isNarrow ? (
                <Pane area="aside" surface label={props.label} {...asideHead}>
                    {props.hasTitle && props.head === null ? (
                        <PaneSection align="center">
                            <PaneHeader title={props.label} {...countStatus} />
                        </PaneSection>
                    ) : null}
                    <PaneSection grow>{props.aside}</PaneSection>
                </Pane>
            ) : null}
        </PaneGrid>
    )
}

/** What the frame takes: the three regions, and what the aside count reads. */
export interface AsideFrameProps {
    /** What the aside count reads; null reads nothing. */
    readonly summary: SpecAsideSummary | null
    readonly reads: ReadonlyArray<ReadDefinition>
    readonly namespace: string
    readonly installationId: string
    readonly params: ParamHandle
    /** The tabs band of the page; null when the host draws the tabs in its header. */
    readonly tabs: ReactNode
    /** The main pane. */
    readonly main: ReactNode
    /** The aside pane. */
    readonly aside: ReactNode
    /** The root node of the aside; the aside is open, with the blocks carrying their own headings, while a node shown by a chosen record stands in it. */
    readonly asideNode?: PlanNode | null
    /** Whether the main pane is a grid of panes of its own. */
    readonly isPanes?: boolean
}

/** The panes of the aside view, with the label and the count the summary names. */
export const AsideFrame = (props: AsideFrameProps): ReactNode => {
    const host = useWorkbenchHost()
    const isNarrow = useIsNarrow()
    const [head, setHead] = useState<AsideHead | null>(null)
    const text = host.block.text("blocks")
    const owner = host.block.text(props.namespace)
    const locale = host.block.locale()
    const summary = props.summary
    const isChosen =
        props.asideNode !== undefined &&
        props.asideNode !== null &&
        isOpenedBySelection(props.asideNode, (name) => props.params.value(name))
    const label =
        summary === null ? text({ key: "renderer.aside" }) : wordsOf(summary.label, (key) => owner({ key }), locale)
    return (
        <SummaryRead summary={summary} reads={props.reads} installationId={props.installationId} params={props.params}>
            {(figures) => (
                <AsidePanes
                    namespace={text({ key: "renderer.main" })}
                    label={label}
                    count={figures.count}
                    isEmpty={figures.isEmpty && !isChosen}
                    hasTitle={summary !== null && !isChosen}
                    isNarrow={isNarrow}
                    isPanes={props.isPanes === true}
                    head={head}
                    isChosen={isChosen}
                    tabs={props.tabs}
                    main={props.main}
                    aside={
                        <AsideHeadProvider setHead={setHead} isHosted={!isNarrow}>
                            {props.aside}
                        </AsideHeadProvider>
                    }
                />
            )}
        </SummaryRead>
    )
}
