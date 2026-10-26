import { Button, Form, Input, Text } from "@starci/grammar/common"
import { SinglePickList } from "@/components/leaves/SinglePickList"
import type { ThreadRailForm, ThreadRowView } from "@/modules/types"
import { FORM_ACTIONS_CLASS_NAME, FORM_CLASS_NAME, HEAD_CLASS_NAME, RAIL_CLASS_NAME } from "./classNames"

/** What the rail draws and asks. */
type ThreadRailProps = {
    readonly title: string
    readonly listLabel: string
    readonly rows: ReadonlyArray<ThreadRowView>
    /** The threads are still loading: the list draws waiting rows. */
    readonly isSkeleton: boolean
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
        <div className={FORM_CLASS_NAME}>
            <Input
                id="thread-title"
                name="title"
                label={props.form.label}
                isLabelHidden
                placeholder={props.form.placeholder}
                value={props.titleDraft}
                onValueChange={props.onTitle}
            />
            <div className={FORM_ACTIONS_CLASS_NAME}>
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
            </div>
        </div>
    </Form>
)

/** The list of threads with the button that opens a new one. */
export const ThreadRail = (props: ThreadRailProps) => (
    <div className={RAIL_CLASS_NAME}>
        <div className={HEAD_CLASS_NAME}>
            <Text weight="semibold">{props.title}</Text>
            <Button intent="neutral" size="sm" isDisabled={props.isSkeleton} onPress={props.onOpenForm}>
                {props.newLabel}
            </Button>
        </div>
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
            isSkeleton={props.isSkeleton}
            onPick={props.onPick}
            rows={props.rows.map((row) => ({
                id: row.id,
                label: row.title,
                description: [row.statusLabel, row.countLabel].join(" · "),
                isSelected: row.isSelected,
            }))}
        />
    </div>
)
