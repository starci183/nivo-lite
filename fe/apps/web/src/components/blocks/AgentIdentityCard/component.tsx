import { SlotBoundView } from "@/components/composites/SlotView"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { DataSlot, ModuleIconName, SlotLabels } from "@/modules/types"
import { Button, Input, SurfaceCard, Text } from "@starci/grammar/common"
import { AgentMark } from "../../leaves/AgentMark"
import { ACTIONS, GROW, ROW, STACK } from "./classNames"

/** What the name card shows once the installation arrived, every word resolved. */
export interface IdentityView {
    readonly markLabel: string
    readonly nameLabel: string
    readonly nameHint: string
    readonly name: string
    readonly maxLength: number
    readonly line: string
    readonly saveLabel: string
    readonly canSave: boolean
}

/** Copy and slot of the name card of an agent. */
export interface AgentIdentityCardBaseProps {
    readonly props: {
        readonly title: string
        readonly glyph: ModuleIconName
        readonly module: string
        readonly isDisabled: boolean
        readonly isPending: boolean
        readonly slot: DataSlot<IdentityView>
        readonly placeholder: IdentityView
        readonly slotLabels: SlotLabels
    }
    readonly on: { readonly name: (value: string) => void; readonly save: () => void; readonly retry: () => void }
}

/** Draws the name card of an agent: its mark, the one name field and its save. */
export const AgentIdentityCardBase = (props: AgentIdentityCardBaseProps) => (
    <SurfaceCard label={props.props.title} headingLevel={2}>
        <SlotBoundView from={props.props} onRetry={props.on.retry}>
            {(view, isSkeleton) => (
                <div className={STACK}>
                    <div className={ROW}>
                        <AgentMark
                            glyph={nivoIconSource(props.props.glyph, "leading")}
                            module={props.props.module}
                            label={view.markLabel}
                            size="lg"
                        />
                        <div className={GROW}>
                            <Input
                                id="module-name"
                                name="name"
                                label={view.nameLabel}
                                description={view.nameHint}
                                value={view.name}
                                isSkeleton={isSkeleton}
                                isDisabled={props.props.isDisabled}
                                onValueChange={(value) => props.on.name(value.slice(0, view.maxLength))}
                            />
                        </div>
                    </div>
                    <Text size="sm" tone="muted" isSkeleton={isSkeleton}>
                        {view.line}
                    </Text>
                    <div className={ACTIONS}>
                        <Button
                            intent="neutral"
                            isSkeleton={isSkeleton}
                            isPending={props.props.isPending}
                            isDisabled={!view.canSave}
                            onPress={props.on.save}
                        >
                            {view.saveLabel}
                        </Button>
                    </div>
                </div>
            )}
        </SlotBoundView>
    </SurfaceCard>
)
