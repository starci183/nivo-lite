import type { ReactNode } from "react"
import { Cluster, Stack, Tabs } from "@starci/grammar/common"
import type { ParamHandle, ReadDefinition } from "../../block/block.types"
import { wordsOf } from "../../schema/namespaced"
import type { PlanView } from "../../spec/render-plan"
import { resolveVariables } from "../../spec/spec-value"
import { useWorkbenchHost } from "../host/WorkbenchHostProvider"
import type { CountChip, ViewChrome } from "./view-chrome"
import { countChipOf } from "./view-chrome"

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
    /** The body of the page. */
    readonly children: ReactNode
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
interface CountChainProps extends Omit<PageFrameProps, "selected" | "panelId" | "onSelect" | "actions" | "children"> {
    readonly rest: ReadonlyArray<PlanView>
    readonly chips: Chips
    readonly done: (chips: Chips) => ReactNode
}

/** Reads the counts of the tabs one after the other, each in a component of its own so every hook list stays stable. */
const CountChain = (props: CountChainProps): ReactNode => {
    const [view, ...rest] = props.rest
    if (view === undefined) return <>{props.done(props.chips)}</>
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

/**
 * The frame of a workbench: the views as page tabs (each with the count of its counts read as a chip, in the attention tone when the
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
            done={(chips) => (
                <Stack gap="region">
                    <Cluster gap="row" align="center" justify="between" wrap={false}>
                        <Tabs
                            label={text({ key: "renderer.tabs" })}
                            {...(props.selected === undefined ? {} : { selectedKey: props.selected })}
                            inset="none"
                            labelVisibility="always"
                            items={visible.map((candidate) => {
                                const chip = chips[candidate.id]
                                return {
                                    id: candidate.id,
                                    label: wordsOf(candidate.label, (key) => owner({ key }), locale),
                                    ...(chip?.count === undefined ? {} : { count: chip.count }),
                                    ...(chip?.isAttention === true ? { isAttention: true } : {}),
                                }
                            })}
                            panelId={props.panelId}
                            onSelect={props.onSelect}
                        />
                        {props.actions}
                    </Cluster>
                    {props.children}
                </Stack>
            )}
        />
    )
}
