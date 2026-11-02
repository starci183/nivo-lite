import { Button, Form, Heading, Input, Stack, Cluster } from "@starci/grammar/common"
import { SinglePickList } from "@/components/leaves/SinglePickList"
import type { ThreadRailForm, ThreadRowView } from "@/modules/types"

/** What the rail draws and asks. */
type ThreadRailProps = {
    readonly title: string
    readonly listLabel: string
    readonly rows: ReadonlyArray<ThreadRowView>
    /** The threads are still loading: the list draws waiting rows. */
    readonly isLoading: boolean
    readonly newLabel: string
    readonly isFormOpen: boolean
    readonly titleDraft: string
    readonly isCreating: boolean
    readonly form: ThreadRailForm
    readonly onPick: (threadId: string) => void
    readonly onOpenForm: () => void
    readonly onCancelForm: () => void
    readonly onTitle: (value: string) => void
    readonly onCreate: () => void
}

/** The new-thread form: the title field and its two buttons. */
const NewThreadForm = (
    props: Pick<ThreadRailProps, "form" | "isCreating" | "titleDraft" | "onCreate" | "onTitle" | "onCancelForm">,
) => (
    <Form
        label={props.form.label}
        isPending={props.isCreating}
        onSubmit={(_data, event) => {
            event.preventDefault()
            props.onCreate()
        }}
    >
        <Stack gap="inline">
            <Input
                id="thread-title"
                name="title"
                label={props.form.label}
                isLabelHidden
                placeholder={props.form.placeholder}
                value={props.titleDraft}
                onValueChange={props.onTitle}
            />
            <Cluster gap="inline">
                <Button
                    type="submit"
                    intent="commit"
                    size="sm"
                    isPending={props.isCreating}
                    isDisabled={props.titleDraft.trim().length === 0}
                >
                    {props.form.createLabel}
                </Button>
                <Button intent="neutral" size="sm" onPress={props.onCancelForm}>
                    {props.form.cancelLabel}
                </Button>
            </Cluster>
        </Stack>
    </Form>
)

/** The list of threads with the button that opens a new one. */
export const ThreadRail = (props: ThreadRailProps) => (
    <Stack gap="row">
        <Cluster gap="inline" justify="between">
            <Heading level={3}>{props.title}</Heading>
            <Button intent="neutral" size="sm" isDisabled={props.isLoading} onPress={props.onOpenForm}>
                {props.newLabel}
            </Button>
        </Cluster>
        {props.isFormOpen ? (
            <NewThreadForm
                form={props.form}
                isCreating={props.isCreating}
                titleDraft={props.titleDraft}
                onCreate={props.onCreate}
                onTitle={props.onTitle}
                onCancelForm={props.onCancelForm}
            />
        ) : null}
        <SinglePickList
            label={props.listLabel}
            isLoading={props.isLoading}
            onPick={props.onPick}
            rows={props.rows.map((row) => ({
                id: row.id,
                label: row.title,
                description: [row.statusLabel, row.countLabel].join(" · "),
                isSelected: row.isSelected,
            }))}
        />
    </Stack>
)
