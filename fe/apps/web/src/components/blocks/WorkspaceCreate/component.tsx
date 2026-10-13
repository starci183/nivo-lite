import { Button, Form, Input, SurfaceCard } from "@starci/grammar/common"
import { FormNotice } from "@/components/composites/FormNotice"
import { ACTIONS_CLASS_NAME, STACK_CLASS_NAME } from "./classNames"

/** Copy, values and state the connected create form supplies. */
export interface WorkspaceCreateBaseProps {
    readonly props: {
        readonly title: string
        readonly nameLabel: string
        readonly nameHint: string
        readonly submitLabel: string
        readonly cancelLabel: string
        readonly cancelHref: string
        readonly failTitle: string
        readonly name: string
        readonly isPending: boolean
        readonly error?: string
    }
    readonly on: {
        readonly setName: (value: string) => void
        readonly submit: () => void
    }
}

/** Draws the form that names a new workspace. */
export const WorkspaceCreateBase = (props: WorkspaceCreateBaseProps) => (
    <SurfaceCard ariaLabel={props.props.title} measure="form">
        <Form label={props.props.title} onSubmit={props.on.submit} isPending={props.props.isPending}>
            <div className={STACK_CLASS_NAME}>
                <Input
                    id="workspace-name"
                    name="name"
                    label={props.props.nameLabel}
                    hint={props.props.nameHint}
                    variant="secondary"
                    isRequired
                    isDisabled={props.props.isPending}
                    value={props.props.name}
                    onValueChange={props.on.setName}
                />
                <FormNotice failTitle={props.props.failTitle} error={props.props.error} />
                <div className={ACTIONS_CLASS_NAME}>
                    <Button type="submit" variant="primary" size="lg" isPending={props.props.isPending}>
                        {props.props.submitLabel}
                    </Button>
                    <Button variant="ghost" href={props.props.cancelHref} isDisabled={props.props.isPending}>
                        {props.props.cancelLabel}
                    </Button>
                </div>
            </div>
        </Form>
    </SurfaceCard>
)
