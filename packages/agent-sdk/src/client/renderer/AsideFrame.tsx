import type { ReactNode } from "react"
import { Badge, Pane, PaneGrid, PaneHeader, PaneSection } from "@starci/grammar/common"
import type { ParamHandle, ReadDefinition } from "../../block/block.types"
import { wordsOf } from "../../schema/namespaced"
import type { SpecAsideSummary } from "../../spec/spec.types"
import { resolveVariables, textOf, valueAt } from "../../spec/spec-value"
import { useWorkbenchHost } from "../host/WorkbenchHostProvider"

/** What the aside summary reads: how much waits, and what is first. */
interface SummaryFigures {
    /** The figure the read gives at the summary's path; empty while unknown. */
    readonly count: string
    /** The text of the first item; empty while unknown or when the summary names none. */
    readonly preview: string
}

const UNKNOWN: SummaryFigures = { count: "", preview: "" }

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
    return props.children({
        count: textOf(valueAt(answer.data, summary.path)),
        preview: summary.previewPath === undefined ? "" : textOf(valueAt(answer.data, summary.previewPath)),
    })
}

/** What the panes take. */
interface AsidePanesProps {
    readonly namespace: string
    /** The tabs band of the page, drawn on top of the main pane on the white ground of the chrome. */
    readonly tabs: ReactNode
    /** The main pane: the well, where the blocks of the view float. */
    readonly main: ReactNode
    /** The aside pane. */
    readonly aside: ReactNode
    /** The label of the aside pane and its title. */
    readonly label: string
    /** How much waits in the aside; empty while unknown. */
    readonly count: string
}

/**
 * The view body of a spec that has an aside, in the depth of the app: the tabs band and the aside are chrome on the white surface (the
 * aside runs the whole height at the end, with a divider on its start edge), and only the main pane is the well, where the blocks float.
 * Below the wide breakpoint there is no aside column: its content is the first block of the well, under the tabs.
 */
const AsidePanes = (props: AsidePanesProps): ReactNode => (
    <PaneGrid
        label={props.label}
        areas={{
            base: ["tabs", "aside", "main"],
            wide: ["tabs aside", "main aside"],
        }}
        columns={{ base: ["fill"], wide: ["fill", "wide"] }}
        rows={{ base: ["auto", "auto", "fill"], wide: ["auto", "fill"] }}
    >
        <Pane area="tabs" surface>
            <PaneSection align="center">{props.tabs}</PaneSection>
        </Pane>
        <Pane area="main" label={props.namespace}>
            <PaneSection>{props.main}</PaneSection>
        </Pane>
        <Pane area="aside" surface label={props.label}>
            <PaneSection align="center">
                <PaneHeader
                    title={props.label}
                    {...(props.count === "" ? {} : { status: <Badge tone="accent">{props.count}</Badge> })}
                />
            </PaneSection>
            <PaneSection grow>{props.aside}</PaneSection>
        </Pane>
    </PaneGrid>
)

/** What the frame takes: the three regions, and what the aside count reads. */
export interface AsideFrameProps {
    /** What the aside count reads; null reads nothing. */
    readonly summary: SpecAsideSummary | null
    readonly reads: ReadonlyArray<ReadDefinition>
    readonly namespace: string
    readonly installationId: string
    readonly params: ParamHandle
    /** The tabs band of the page. */
    readonly tabs: ReactNode
    /** The main pane. */
    readonly main: ReactNode
    /** The aside pane. */
    readonly aside: ReactNode
}

/** The panes of the aside view, with the label and the count the summary names. */
export const AsideFrame = (props: AsideFrameProps): ReactNode => {
    const host = useWorkbenchHost()
    const text = host.block.text("blocks")
    const owner = host.block.text(props.namespace)
    const locale = host.block.locale()
    const summary = props.summary
    const label =
        summary === null ? text({ key: "renderer.aside" }) : wordsOf(summary.label, (key) => owner({ key }), locale)
    return (
        <SummaryRead summary={summary} reads={props.reads} installationId={props.installationId} params={props.params}>
            {(figures) => (
                <AsidePanes
                    namespace={text({ key: "renderer.main" })}
                    label={label}
                    count={figures.count}
                    tabs={props.tabs}
                    main={props.main}
                    aside={props.aside}
                />
            )}
        </SummaryRead>
    )
}
