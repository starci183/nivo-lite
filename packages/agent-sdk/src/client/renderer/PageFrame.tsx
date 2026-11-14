import { useEffect, useRef, type ReactNode } from "react"
import { Cluster, Tabs } from "@starci/grammar/common"
import type { ParamHandle, ReadDefinition } from "../../block/block.types"
import { wordsOf } from "../../schema/namespaced"
import type { PlanView } from "../../spec/render-plan"
import { resolveVariables } from "../../spec/spec-value"
import { useWorkbenchHost } from "../host/WorkbenchHostProvider"
import { type CountChip, type ViewChrome, countChipOf } from "./view-chrome"

/** The tab row of a workbench as data, for a host that draws it in its own header (the app frame's second tab layer). */
export interface PageFrameTabs {
    readonly label: string
    readonly items: ReadonlyArray<{
        readonly id: string
        readonly label: string
        readonly count?: number
        readonly isAttention?: boolean
    }>
    readonly selectedKey?: string
    readonly panelId: string | ((id: string) => string)
    readonly onSelect: (id: string) => void
    /** The view's primary command, to stand at the end of the row. */
    readonly end: ReactNode
}

/** What the page frame takes. */
export interface PageFrameProps {
    /** The views of the plan; hidden ones draw no tab. */
    readonly views: ReadonlyArray<PlanView>
    /** What each view declares beyond its tree, by view id. */
    readonly chrome: ReadonlyArray<ViewChrome>
    readonly reads: ReadonlyArray<ReadDefinition>
    readonly namespace: string
    readonly installationId: string
    readonly params: ParamHandle
    /** The id of the open view. */
    readonly selected: string | undefined
    readonly panelId: (id: string) => string
    readonly onSelect: (id: string) => void
    /** The page's commands at the end of the tabs band. */
    readonly actions: ReactNode
    /**
     * Where the tab row goes when the host draws it itself: the frame publishes the row here (null when it unmounts) and draws no
     * tabs band, so the body is given `null` for its band.
     */
    readonly tabsSink?: (tabs: PageFrameTabs | null) => void
    /** The page from its tabs band: the body takes the band and places it (above the body, or inside its main pane). */
    readonly children: (tabs: ReactNode) => ReactNode
}

/** The chips known so far, by view id. */
type Chips = Readonly<Record<string, CountChip>>

/** What the count of one tab takes. */
interface TabCountProps {
    readonly chrome: ViewChrome | undefined
    readonly reads: ReadonlyArray<ReadDefinition>
    readonly installationId: string
    readonly params: ParamHandle
    readonly children: (chip: CountChip | null) => ReactNode
}

/** The count read of one tab: runs under the viewer rights, never while a param it needs has no value, and says what the chip shows. */
const TabCount = (props: TabCountProps): ReactNode => {
    const host = useWorkbenchHost()
    const binding = props.chrome?.count
    const read = binding === undefined ? undefined : props.reads.find((candidate) => candidate.id === binding.read)
    const isAllowed = host.useCan(read?.permission ?? null)
    const resolved = resolveVariables(binding?.variables, props.installationId, props.params.value)
    const isActive = read !== undefined && isAllowed && resolved.pending.length === 0
    const answer = host.useRead(read?.operation ?? "", isActive ? resolved.variables : null)
    return props.children(binding === undefined || !isActive ? null : countChipOf(answer, binding))
}

/** What the chain of counts takes. */
interface CountChainProps extends Omit<
    PageFrameProps,
    "selected" | "panelId" | "onSelect" | "actions" | "children" | "tabsSink"
> {
    readonly rest: ReadonlyArray<PlanView>
    readonly chips: Chips
    readonly done: (chips: Chips) => ReactNode
}

/** Reads the counts of the tabs one after the other, each in a component of its own so every hook list stays stable. */
const CountChain = (props: CountChainProps): ReactNode => {
    const [view, ...rest] = props.rest
    if (view === undefined) return props.done(props.chips)
    return (
        <TabCount
            chrome={props.chrome.find((candidate) => candidate.id === view.id)}
            reads={props.reads}
            installationId={props.installationId}
            params={props.params}
        >
            {(chip) => (
                <CountChain
                    {...props}
                    rest={rest}
                    chips={chip === null ? props.chips : { ...props.chips, [view.id]: chip }}
                />
            )}
        </TabCount>
    )
}

/** What the publisher of the tab row takes. */
interface TabsPublisherProps {
    readonly sink: (tabs: PageFrameTabs | null) => void
    readonly tabs: PageFrameTabs
}

/** Hands the tab row to the host when its data changes, never for a new closure (the latest handlers are read through a ref). */
const TabsPublisher = (props: TabsPublisherProps): ReactNode => {
    const latest = useRef(props.tabs)
    latest.current = props.tabs
    const { sink, tabs } = props
    const key = JSON.stringify([tabs.label, tabs.items, tabs.selectedKey])
    useEffect(() => {
        const current = latest.current
        sink({
            ...current,
            panelId: (id) => (typeof current.panelId === "function" ? current.panelId(id) : current.panelId),
            onSelect: (id) => latest.current.onSelect(id),
        })
    }, [sink, key])
    useEffect(() => () => sink(null), [sink])
    return null
}

/**
 * The frame of a workbench: the views as page tabs (the default underline tabs, or the host's second tab layer through `tabsSink`; each with the count of its counts read as a chip, in the attention tone when the
 * view declares it and something waits), the view's primary command at the end of the band, and the body under them. A tab shows no
 * number while its count is unknown; the tab never waits for it.
 */
export const PageFrame = (props: PageFrameProps): ReactNode => {
    const host = useWorkbenchHost()
    const text = host.block.text("blocks")
    const owner = host.block.text(props.namespace)
    const locale = host.block.locale()
    const visible = props.views.filter((candidate) => !candidate.hidden)
    return (
        <CountChain
            {...props}
            rest={visible}
            chips={{}}
            done={(chips) => {
                const items = visible.map((candidate) => {
                    const chip = chips[candidate.id]
                    return {
                        id: candidate.id,
                        label: wordsOf(candidate.label, (key) => owner({ key }), locale),
                        ...(chip?.count === undefined ? {} : { count: chip.count }),
                        ...(chip?.isAttention === true ? { isAttention: true } : {}),
                    }
                })
                const common = {
                    label: text({ key: "renderer.tabs" }),
                    ...(props.selected === undefined ? {} : { selectedKey: props.selected }),
                    panelId: props.panelId,
                    onSelect: props.onSelect,
                    labelVisibility: "always" as const,
                }
                if (props.tabsSink !== undefined)
                    return (
                        <>
                            <TabsPublisher
                                sink={props.tabsSink}
                                tabs={{
                                    label: common.label,
                                    items,
                                    ...(props.selected === undefined ? {} : { selectedKey: props.selected }),
                                    panelId: props.panelId,
                                    onSelect: props.onSelect,
                                    end: props.actions,
                                }}
                            />
                            {props.children(null)}
                        </>
                    )
                return props.children(
                    <Cluster gap="row" align="center" justify="between" wrap={false}>
                        <Tabs {...common} items={items} />
                        {props.actions}
                    </Cluster>,
                )
            }}
        />
    )
}
