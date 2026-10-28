import { Switch, SurfaceCard, Text } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SepayAgentView, SlotLabels } from "@/modules/types"
import { sepayAgentsClassNames as classNames } from "./classNames"

/** Props for {@link SepayAgentsBase}. */
export interface SepayAgentsBaseProps {
    readonly props: {
        readonly title: string
        readonly hint: string
        readonly slot: DataSlot<ReadonlyArray<SepayAgentView>>
        readonly placeholder: ReadonlyArray<SepayAgentView>
        readonly labels: SlotLabels
        readonly isDisabled: boolean
    }
    readonly on: { readonly retry: () => void; readonly toggle: (agentId: string, isOn: boolean) => void }
}

/** Draws the agents that may use this connection, each with a switch. */
export const SepayAgentsBase = (props: SepayAgentsBaseProps) => (
    <SurfaceCard label={props.props.title} headingLevel={2}>
        <div className={classNames.list}>
            <Text size="sm" tone="muted">
                {props.props.hint}
            </Text>
            <SlotView
                slot={props.props.slot}
                placeholder={props.props.placeholder}
                labels={props.props.labels}
                onRetry={props.on.retry}
            >
                {(agents, isSkeleton) => (
                    <>
                        {agents.map((agent) => (
                            <Switch
                                key={agent.id}
                                name={`agent-${agent.id}`}
                                label={agent.name}
                                isSelected={agent.isOn}
                                isSkeleton={isSkeleton}
                                isDisabled={props.props.isDisabled || isSkeleton}
                                onSelectedChange={(isOn) => props.on.toggle(agent.id, isOn)}
                            />
                        ))}
                    </>
                )}
            </SlotView>
        </div>
    </SurfaceCard>
)
