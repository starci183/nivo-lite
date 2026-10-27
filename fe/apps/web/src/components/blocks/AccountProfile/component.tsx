import { Form, Input, SurfaceCard } from "@starci/grammar/common"
import { AvatarEditor } from "@/components/composites/AvatarEditor"
import { FormActions } from "@/components/composites/FormActions"
import { SlotView } from "@/components/composites/SlotView"
import { PersonAvatar } from "@/components/leaves/PersonAvatar"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { FORM_CLASS_NAME, STACK_CLASS_NAME } from "./classNames"

/** Copy, values and state the connected profile card supplies. */
export interface AccountProfileBaseProps {
    readonly props: {
        readonly title: string
        /** The person's id: the generated avatar when there is no picture. */
        readonly seed: string | undefined
        /** The live preview: the chosen picture while it uploads, else the saved one, else none. */
        readonly picture: string | null
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
        readonly nameHint: string
        readonly saveLabel: string
        readonly failTitle: string
        readonly name: string
        readonly isPending: boolean
        /** The account read: the card draws once it arrived. */
        readonly slot: DataSlot<true>
        readonly labels: SlotLabels
        readonly error?: string | undefined
        readonly done?: string
    }
    readonly on: {
        readonly pick: (files: Array<File>) => void
        readonly remove: () => void
        readonly setName: (value: string) => void
        readonly submit: () => void
        readonly retry: () => void
    }
}

/** Draws the profile card (the picture with its live preview, then the display name) without reading copy or data. */
export const AccountProfileBase = (props: AccountProfileBaseProps) => (
    <SlotView slot={props.props.slot} placeholder labels={props.props.labels} onRetry={props.on.retry}>
        {(_, isSkeleton) => (
            <SurfaceCard label={props.props.title} headingLevel={2}>
                <div className={STACK_CLASS_NAME}>
                    <AvatarEditor
                        id="account-avatar"
                        preview={
                            <PersonAvatar
                                name={props.props.name}
                                seed={props.props.seed}
                                src={props.props.picture}
                                size="lg"
                            />
                        }
                        {...props.props.avatar}
                        onPick={props.on.pick}
                        onRemove={props.on.remove}
                    />
                    <Form label={props.props.title} onSubmit={props.on.submit} isPending={props.props.isPending}>
                        <div className={FORM_CLASS_NAME}>
                            <Input
                                id="account-name"
                                name="name"
                                label={props.props.nameLabel}
                                description={props.props.nameHint}
                                isRequired
                                isDisabled={props.props.isPending}
                                isSkeleton={isSkeleton}
                                value={props.props.name}
                                onValueChange={props.on.setName}
                            />
                            <FormActions
                                failTitle={props.props.failTitle}
                                error={props.props.error}
                                done={props.props.done}
                                submitLabel={props.props.saveLabel}
                                isPending={props.props.isPending}
                                isSkeleton={isSkeleton}
                            />
                        </div>
                    </Form>
                </div>
            </SurfaceCard>
        )}
    </SlotView>
)
