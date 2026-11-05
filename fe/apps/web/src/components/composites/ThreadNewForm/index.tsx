import { Button, Cluster, Form, Input, Stack } from "@starci/grammar/common"
import type { ThreadRailForm } from "@/modules/types"

/** What the new-thread form draws and asks. */
interface ThreadNewFormProps {
    readonly form: ThreadRailForm
    readonly isCreating: boolean
    readonly titleDraft: string
    readonly onCreate: () => void
    readonly onTitle: (value: string) => void
    readonly onCancelForm: () => void
}

/** The new-thread form: the title field, then Cancel and the one filled command at the end. */
export const ThreadNewForm = (props: ThreadNewFormProps) => (
    <Form
        label={props.form.label}
        isPending={props.isCreating}
        onSubmit={(_data, event) => {
            event.preventDefault()
            props.onCreate()
        }}
    >
        <Stack gap="row">
            <Input
                id="thread-title"
                name="title"
                label={props.form.label}
                placeholder={props.form.placeholder}
                value={props.titleDraft}
                onValueChange={props.onTitle}
            />
            <Cluster gap="inline" justify="end">
                <Button intent="neutral" onPress={props.onCancelForm}>
                    {props.form.cancelLabel}
                </Button>
                <Button
                    type="submit"
                    intent="commit"
                    isPending={props.isCreating}
                    isDisabled={props.titleDraft.trim().length === 0}
                >
                    {props.form.createLabel}
                </Button>
            </Cluster>
        </Stack>
    </Form>
)
