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
        readonly error?: string | undefined
    }
    readonly on: {
        readonly setName: (value: string) => void
        readonly submit: () => void
    }
}

/** Draws the form that names a new workspace. */
export const WorkspaceCreateBase = (props: WorkspaceCreateBaseProps) => {
    const { props: form, on } = props

    return (
        <SurfaceCard ariaLabel={form.title} measure="form">
            <Form label={form.title} onSubmit={on.submit} isPending={form.isPending}>
                <div className={STACK_CLASS_NAME}>
                    <Input
                        id="workspace-name"
                        name="name"
                        label={form.nameLabel}
                        description={form.nameHint}
                        isRequired
                        isDisabled={form.isPending}
                        value={form.name}
                        onValueChange={on.setName}
                    />
                    <FormNotice failTitle={form.failTitle} error={form.error} />
                    <div className={ACTIONS_CLASS_NAME}>
                        <Button type="submit" intent="commit" isPending={form.isPending}>
                            {form.submitLabel}
                        </Button>
                        <Button intent="neutral" href={form.cancelHref} isDisabled={form.isPending}>
                            {form.cancelLabel}
                        </Button>
                    </div>
                </div>
            </Form>
        </SurfaceCard>
    )
}
