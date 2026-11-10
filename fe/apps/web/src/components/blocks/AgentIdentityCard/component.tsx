import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { DataSlot, ModuleIconName, SlotLabels } from "@/modules/types"
import { AvatarEditor } from "@/components/composites/AvatarEditor"
import { FieldBlock } from "@/components/frames/FieldBlock"
import { AgentMark } from "../../leaves/AgentMark"

/** What the picture field shows once the installation arrived, every word resolved. */
export interface IdentityView {
    readonly markLabel: string
    /** The id of the agent: the seed every mark of this agent draws its waiting colour from. */
    readonly markSeed: string
    /** The picture the agent wears (an upload, or a chosen file while it uploads); null draws the default sprout. */
    readonly avatarUrl: string | null
}

/** The words of the picture editor (the upload pill, what is accepted, a refusal). */
export interface IdentityEditorView {
    readonly label: string
    readonly pickLabel: string
    readonly hint: string
    readonly accept: string
    readonly error?: string | undefined
    /** The word of the pill that goes back to the default sprout. */
    readonly removeLabel: string
    /** Draws the reset as a small neutral pill. */
    readonly isRemoveCompact?: boolean
    readonly canRemove: boolean
    readonly isBusy: boolean
}

/** Copy and slot of the picture field of an agent. */
export interface AgentIdentityCardBaseProps {
    readonly props: {
        readonly title: string
        readonly glyph: ModuleIconName
        readonly module: string
        readonly isDisabled: boolean
        readonly editor: IdentityEditorView
        /** The read, its same-shape placeholder and the words of its states, as SlotView takes them. */
        readonly read: {
            readonly slot: DataSlot<IdentityView>
            readonly placeholder: IdentityView
            readonly labels: SlotLabels
        }
    }
    readonly on: {
        readonly retry: () => void
        readonly upload: (files: Array<File>) => void
        readonly remove: () => void
    }
}

/** Draws the picture of an agent as one flat field: the avatar (the sprout until a picture is uploaded), the upload button, and a small reset while a picture is uploaded. */
export const AgentIdentityCardBase = (props: AgentIdentityCardBaseProps) => (
    <SlotView
        {...props.props.read}
        onRetry={props.on.retry}
        render={(view, isLoading) => (
            <FieldBlock title={props.props.title}>
                <AvatarEditor
                    preview={
                        <AgentMark
                            label={view.markLabel}
                            seed={view.markSeed}
                            src={view.avatarUrl}
                            isLoading={isLoading}
                            size="lg"
                        />
                    }
                    {...props.props.editor}
                    isBusy={props.props.editor.isBusy || props.props.isDisabled}
                    isLoading={isLoading}
                    onPick={props.on.upload}
                    onRemove={props.on.remove}
                />
            </FieldBlock>
        )}
    />
)
