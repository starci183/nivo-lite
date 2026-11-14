import type { ReactNode } from "react"
import { SlotView, useBlockHost } from "@nivo-lite/agent-sdk/client"
import { FlowGraph, Link, Stack, SurfaceCard } from "@starci/grammar/common"
import type { agentFlowsBlock } from "../../blocks/agent-flows.block"
import {
    DESK_FLOWS_PLACEHOLDER,
    deskFlowsView,
    filledText,
    type DeskFlowCard,
    type DeskFlowsCard,
} from "../../rows/desk-views"
import { derivedSlot, parsedSlot } from "../../slots/slots"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import { stepsFlowOf, stepsStatusLabelsOf } from "../graph/steps-flow"
import type { RenderOf } from "../render-props"

/** One workflow as the canvas draws it: the Grammar's step cards (`layout="steps"`) of the installed graph, static (no pan, zoom or controls), small, contained. */
const flowMapOf = (flow: DeskFlowCard, locale: "vi" | "en"): ReactNode => {
    const steps = flow.graph === null ? { nodes: [], edges: [] } : stepsFlowOf(flow.graph, locale)
    return (
        <FlowGraph
            label={flow.name}
            nodes={steps.nodes}
            edges={steps.edges}
            layout="steps"
            direction="LR"
            height="sm"
            fit="contain"
            isInteractive={false}
            showControls={false}
            statusLabels={stepsStatusLabelsOf(locale)}
        />
    )
}

/**
 * How the agent works: every active workflow as the canvas's step cards, read-only, ONE graph per card (a card holds one content): the
 * first card is headed by the block's words and the fact of how many workflows and steps, with its workflow's name as the head link to
 * that workflow's page; each further workflow is its own card, named by it. While it loads one card keeps its words and the canvas frame
 * shows its skeleton; with no workflow it says so inside the card.
 */
export const AgentFlowsBlock = (props: RenderOf<typeof agentFlowsBlock>): ReactNode => {
    const host = useBlockHost()
    const words = useBlockWords()
    const labels = useSlotLabels(props.props.empty)
    const locale = host.locale() === "en" ? "en" : "vi"
    const read = props.slots.flows
    const flows = derivedSlot(parsedSlot(read.slot, deskFlowsView), (view: DeskFlowsCard) =>
        view.flows.length === 0 ? null : view,
    )
    const label = words(props.props.label)
    const factOf = (view: DeskFlowsCard): { readonly fact?: string } =>
        props.props.fact === undefined || view.workflows === 0
            ? {}
            : {
                  fact: filledText(words(props.props.fact), {
                      workflows: String(view.workflows),
                      steps: String(view.steps),
                  }),
              }
    const hrefOf = (key: string): string | null =>
        props.props.flowPath === undefined ? null : host.navigation.href(filledText(props.props.flowPath, { key }))
    return (
        <SlotView
            slot={flows}
            labels={labels}
            placeholder={DESK_FLOWS_PLACEHOLDER}
            onRetry={read.retry}
            frame={(notice) => (
                <SurfaceCard label={label} headingLevel={3}>
                    {notice}
                </SurfaceCard>
            )}
            render={(view, isLoading) =>
                isLoading ? (
                    <SurfaceCard label={label} headingLevel={3}>
                        <FlowGraph label={label} nodes={[]} edges={[]} layout="steps" height="sm" isLoading />
                    </SurfaceCard>
                ) : (
                    <Stack gap="section">
                        {view.flows.map((flow, index) => {
                            const href = hrefOf(flow.key)
                            const head =
                                index === 0
                                    ? { label, ...factOf(view) }
                                    : { label: flow.name }
                            const link =
                                href === null || index > 0 ? {} : { labelEnd: <Link href={href} variant="head">{flow.name}</Link> }
                            return (
                                <SurfaceCard key={flow.key} {...head} {...link} headingLevel={3}>
                                    {flowMapOf(flow, locale)}
                                </SurfaceCard>
                            )
                        })}
                    </Stack>
                )
            }
        />
    )
}
