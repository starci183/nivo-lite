import { SlotView } from "@/components/composites/SlotView"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { DataSlot, ModuleIconName, SlotLabels } from "@/modules/types"
import { Button, Cluster, Input, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import { AgentMark } from "../../leaves/AgentMark"
import { GROW } from "./classNames"

/** What the name card shows once the installation arrived, every word resolved. */
export interface IdentityView {
    readonly markLabel: string
    /** The picture the owner gave the agent; null draws the NIVO unicorn mascot. */
    readonly avatarUrl: string | null
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
        /** The read, its same-shape placeholder and the words of its states, as SlotView takes them. */
        readonly read: {
            readonly slot: DataSlot<IdentityView>
            readonly placeholder: IdentityView
            readonly labels: SlotLabels
        }
    }
    readonly on: { readonly name: (value: string) => void; readonly save: () => void; readonly retry: () => void }
}

/** Draws the name card of an agent: its mark, the one name field and its save. */
export const AgentIdentityCardBase = (props: AgentIdentityCardBaseProps) => (
    <SurfaceCard label={props.props.title} headingLevel={2}>
        <SlotView {...props.props.read} onRetry={props.on.retry}>
            {(view, isSkeleton) => (
                <Stack gap="section">
                    <Cluster gap="row" wrap={false} align="end">
                        <AgentMark
                            glyph={nivoIconSource(props.props.glyph, "leading")}
                            module={props.props.module}
                            label={view.markLabel}
                            src={view.avatarUrl}
                            size="lg"
                        />
                        <div className={GROW}>
                            <Input
                                id="module-name"
                                name="name"
                                label={view.nameLabel}
                                isLabelHidden
                                description={view.nameHint}
                                value={view.name}
                                isSkeleton={isSkeleton}
                                isDisabled={props.props.isDisabled}
                                onValueChange={(value) => props.on.name(value.slice(0, view.maxLength))}
                            />
                        </div>
                    </Cluster>
                    <Text size="sm" tone="muted" isSkeleton={isSkeleton}>
                        {view.line}
                    </Text>
                    <Cluster gap="row">
                        <Button
                            intent="neutral"
                            isSkeleton={isSkeleton}
                            isPending={props.props.isPending}
                            isDisabled={!view.canSave}
                            onPress={props.on.save}
                        >
                            {view.saveLabel}
                        </Button>
                    </Cluster>
                </Stack>
            )}
        </SlotView>
    </SurfaceCard>
)
