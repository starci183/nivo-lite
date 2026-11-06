import type { ReactNode } from "react"
import { Alert, Badge, Pane, PaneGrid, PaneHeader, PaneSection } from "@starci/grammar/common"
import type { ParamHandle, ReadDefinition } from "../../block/block.types"
import { wordsOf } from "../../schema/namespaced"
import { PANE_PARAM } from "../../spec/spec"
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

/** What the two panes take. */
export interface AsideFrameProps {
    /** What the phone shows of the aside on the main pane; null shows nothing. */
    readonly summary: SpecAsideSummary | null
    readonly reads: ReadonlyArray<ReadDefinition>
    readonly namespace: string
    readonly installationId: string
    readonly params: ParamHandle
    /** Whether a phone shows the aside pane (else the main one). */
    readonly isAsideShown: boolean
    /** The tabs band of the page, drawn on top of the main pane. */
    readonly tabs: ReactNode
    /** The main pane. */
    readonly main: ReactNode
    /** The aside pane. */
    readonly aside: ReactNode
}

/** The arrangement of a phone, which shows one pane at a time: the tabs, the summary line of the aside, then the main pane. */
const phoneAreas = (isAsideShown: boolean, hasSummary: boolean): ReadonlyArray<string> => {
    if (isAsideShown) return ["aside"]
    return hasSummary ? ["tabs", "summary", "main"] : ["tabs", "main"]
}

/**
 * The view body of a spec that has an aside: the main pane and the aside pane side by side, and on a phone one at a time as the
 * `pane` param says. The tabs band tops the main pane, and the aside runs the whole height beside it; on a phone the tabs are followed
 * by the summary line of the aside, and the aside pane shows alone with its head and a way back to the main pane.
 */
export const AsideFrame = (props: AsideFrameProps): ReactNode => {
    const host = useWorkbenchHost()
    const text = host.block.text("blocks")
    const owner = host.block.text(props.namespace)
    const locale = host.block.locale()
    const summary = props.summary
    const label =
        summary === null ? text({ key: "renderer.aside" }) : wordsOf(summary.label, (key) => owner({ key }), locale)
    const phone = phoneAreas(props.isAsideShown, summary !== null)
    return (
        <SummaryRead summary={summary} reads={props.reads} installationId={props.installationId} params={props.params}>
            {(figures) => (
                <PaneGrid
                    label={label}
                    areas={{
                        base: phoneAreas(props.isAsideShown, summary !== null),
                        medium: ["tabs aside", "main aside"],
                    }}
                    columns={{ base: ["fill"], medium: ["fill", "wide"] }}
                    rows={{
                        base: phone.map((area) => (area === "main" || area === "aside" ? "fill" : "auto")),
                        medium: ["auto", "fill"],
                    }}
                >
                    {summary === null ? null : (
                        <Pane area="summary" surface>
                            <PaneSection>
                                <Alert
                                    tone="accent"
                                    title={figures.count === "" ? label : `${label} · ${figures.count}`}
                                    {...(figures.preview === "" ? {} : { description: figures.preview })}
                                    action={{
                                        kind: "row",
                                        label,
                                        onAction: () => props.params.set(PANE_PARAM, summary.opens),
                                    }}
                                />
                            </PaneSection>
                        </Pane>
                    )}
                    <Pane area="tabs" surface>
                        <PaneSection align="center">{props.tabs}</PaneSection>
                    </Pane>
                    <Pane area="main" label={text({ key: "renderer.main" })} surface>
                        <PaneSection>{props.main}</PaneSection>
                    </Pane>
                    <Pane area="aside" label={label} surface>
                        <PaneSection align="center">
                            <PaneHeader
                                title={label}
                                {...(figures.count === ""
                                    ? {}
                                    : { status: <Badge tone="accent">{figures.count}</Badge> })}
                                back={{
                                    label: text({ key: "renderer.back" }),
                                    onPress: () => props.params.set(PANE_PARAM, "list"),
                                    placement: "narrow",
                                }}
                            />
                        </PaneSection>
                        <PaneSection grow>{props.aside}</PaneSection>
                    </Pane>
                </PaneGrid>
            )}
        </SummaryRead>
    )
}
