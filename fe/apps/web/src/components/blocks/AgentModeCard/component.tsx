import { SurfaceCard, Text } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** What the mode card shows once the installation arrived. */
export interface ModeView {
    readonly mode: string
    /** Authority is shared by every instance of the type; empty for a single instance agent. */
    readonly sharedNote: string
}

/** One choice of the card: its title and the subtitle under it. */
export interface ModeOption {
    readonly value: string
    readonly label: string
    readonly subtitle: string
}

/** Copy and slot of the operating mode card. */
export interface AgentModeCardBaseProps {
    readonly props: {
        readonly title: string
        readonly options: ReadonlyArray<ModeOption>
        readonly isDisabled: boolean
        /** The read, its same-shape placeholder and the words of its states, as SlotView takes them. */
        readonly read: {
            readonly slot: DataSlot<ModeView>
            readonly placeholder: ModeView
            readonly labels: SlotLabels
        }
    }
    readonly on: { readonly mode: (value: string) => void; readonly retry: () => void }
}

/**
 * The one choice list of the card: `SurfaceCard kind="select" selectionMode="single"` (Grammar 0.37.5), a checkbox row per mode.
 */
const ModeChoice = (props: AgentModeCardBaseProps, view: ModeView, isLoading: boolean) => (
    <SurfaceCard
        kind="select"
        selectionMode="single"
        label={props.props.title}
        headingLevel={2}
        isLoading={isLoading}
        {...(view.sharedNote === ""
            ? {}
            : {
                  note: (
                      <Text size="xs" tone="muted">
                          {view.sharedNote}
                      </Text>
                  ),
              })}
        items={props.props.options.map((option) => ({
            id: option.value,
            title: option.label,
            subtitle: option.subtitle,
            isDisabled: props.props.isDisabled,
        }))}
        value={view.mode}
        onChange={props.on.mode}
    />
)

/** Draws the operating mode as one field with its choice card: assist or autopilot, each a row with a title and a subtitle. */
export const AgentModeCardBase = (props: AgentModeCardBaseProps) => (
    <SlotView
        {...props.props.read}
        onRetry={props.on.retry}
        render={(view, isLoading) => ModeChoice(props, view, isLoading)}
    />
)
