import { Form, Input, SurfaceCard } from "@starci/grammar/common"
import { AvatarEditor } from "@/components/composites/AvatarEditor"
import { FormActions } from "@/components/composites/FormActions"
import { AgentMark } from "@/components/leaves/AgentMark"
import { FORM_CLASS, STACK_CLASS } from "./classNames"

/** Copy, values and state of the agent identity card. */
export interface AgentProfileIdentityBaseProps {
    readonly props: {
        readonly title: string
        /** The agent id: the generated avatar of an agent without a picture. */
        readonly seed: string
        /** The live preview: the chosen picture while it uploads, else the saved one, else null. */
        readonly picture: string | null
        readonly name: string
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
        readonly nameError?: string | undefined
        readonly saveLabel: string
        readonly failTitle: string
        readonly isSaving: boolean
        readonly isLoading: boolean
    }
    readonly on: {
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
            <div className={STACK_CLASS}>
                <AvatarEditor
                    id="agent-avatar"
                    preview={<AgentMark label={view.name} seed={view.seed} src={view.picture} size="lg" />}
                    {...view.avatar}
                    onPick={props.on.pick}
                    onRemove={props.on.remove}
                />
                <Form label={view.title} onSubmit={props.on.save} isPending={view.isSaving}>
                    <div className={FORM_CLASS}>
                        <Input
                            id="agent-name"
                            name="name"
                            label={view.nameLabel}
                            hint={view.nameHint}
                            isRequired
                            isDisabled={view.isSaving}
                            isSkeleton={view.isLoading}
                            isError={view.nameError !== undefined}
                            errorMessage={view.nameError}
                            value={view.name}
                            onValueChange={props.on.setName}
                        />
                        <FormActions
                            failTitle={view.failTitle}
                            submitLabel={view.saveLabel}
                            isPending={view.isSaving}
                            isSkeleton={view.isLoading}
                        />
                    </div>
                </Form>
            </div>
        </SurfaceCard>
    )
}
