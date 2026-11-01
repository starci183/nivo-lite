import { Form, Input, Stack, SurfaceCard } from "@starci/grammar/common"
import { AvatarEditor } from "@/components/composites/AvatarEditor"
import { FormActions } from "@/components/composites/FormActions"
import { SlotView } from "@/components/composites/SlotView"
import { AgentMark } from "@/components/leaves/AgentMark"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** What the identity card shows once the agent arrived. */
export interface ProfileIdentityView {
    /** The live preview: the chosen picture while it uploads, else the saved one, else null. */
    readonly picture: string | null
    readonly name: string
    readonly nameHint: string
}

/** Copy, values and slot of the agent identity card. */
export interface AgentProfileIdentityBaseProps {
    readonly props: {
        readonly title: string
        /** The agent id: the generated avatar of an agent without a picture. */
        readonly seed: string
        readonly avatar: {
            readonly label: string
            readonly prompt: string
            readonly hint: string
            readonly accept: string
            readonly error?: string | undefined
            readonly removeLabel: string
            readonly canRemove: boolean
            readonly isBusy: boolean
        }
        readonly nameLabel: string
        readonly nameError?: string | undefined
        readonly saveLabel: string
        readonly failTitle: string
        readonly isSaving: boolean
        readonly slot: DataSlot<ProfileIdentityView>
        readonly placeholder: ProfileIdentityView
        readonly slotLabels: SlotLabels
    }
    readonly on: {
        readonly retry: () => void
        readonly pick: (files: Array<File>) => void
        readonly remove: () => void
        readonly setName: (value: string) => void
        readonly save: () => void
    }
}

/** Draws the agent's picture and display name, edited like a person's profile. */
export const AgentProfileIdentityBase = (props: AgentProfileIdentityBaseProps) => {
    const view = props.props
    return (
        <SurfaceCard label={view.title} headingLevel={2}>
            <SlotView slot={view.slot} placeholder={view.placeholder} labels={view.slotLabels} onRetry={props.on.retry}>
                {(identity, isSkeleton) => (
                    <Stack gap="region">
                        <AvatarEditor
                            id="agent-avatar"
                            preview={
                                <AgentMark label={identity.name} seed={view.seed} src={identity.picture} size="lg" />
                            }
                            {...view.avatar}
                            onPick={props.on.pick}
                            onRemove={props.on.remove}
                        />
                        <Form label={view.title} onSubmit={props.on.save} isPending={view.isSaving}>
                            <Stack gap="section" measure="form">
                                <Input
                                    id="agent-name"
                                    name="name"
                                    label={view.nameLabel}
                                    description={identity.nameHint}
                                    isRequired
                                    isDisabled={view.isSaving}
                                    isSkeleton={isSkeleton}
                                    isError={view.nameError !== undefined}
                                    errorMessage={view.nameError}
                                    value={identity.name}
                                    onValueChange={props.on.setName}
                                />
                                <FormActions
                                    failTitle={view.failTitle}
                                    submitLabel={view.saveLabel}
                                    isPending={view.isSaving}
                                    isSkeleton={isSkeleton}
                                />
                            </Stack>
                        </Form>
                    </Stack>
                )}
            </SlotView>
        </SurfaceCard>
    )
}
