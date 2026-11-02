import type { HiringViews, HiringActions } from "@/modules/types"

import { Alert, Button, CheckboxGroup, Dialog, Heading, Textarea, Stack } from "@starci/grammar/common"
import { HiringJobFields } from "@/components/leaves/HiringJobFields"

import { HiringRequirementFields } from "@/components/branches/HiringRequirementFields"
import { HiringQuestionList } from "@/components/branches/HiringQuestionList"

/** The words, values and state of the job editor dialog. */
type HiringJobEditorDialogProps = HiringViews["jobEditorFields"] & {
    readonly on: HiringActions["jobEditorActions"]
}

/** The dialog that creates or edits one job post: the post itself, what candidates are screened on, and their questions. */
export const HiringJobEditorDialog = (props: HiringJobEditorDialogProps) => {
    const { copy, values, isBusy, error } = props
    const { on } = props
    return (
        <Dialog
            isOpen
            onOpenChange={(open) => {
                if (!open) on.close()
            }}
            size="lg"
            title={props.isNew ? copy.jobEditorNew : copy.jobEditorEdit}
            closeLabel={copy.close}
            description={copy.jobEditorHint}
            footer={
                <HiringEditorFooter
                    copy={copy}
                    isBusy={isBusy}
                    canSave={props.canSave}
                    onClose={on.close}
                    onSave={on.save}
                />
            }
        >
            <Stack gap="row">
                {error === null ? null : <Alert tone="negative" title={copy.errorNotSaved} description={error} />}
                <HiringJobFields
                    copy={copy}
                    values={values}
                    employmentOptions={props.employmentOptions}
                    payUnitOptions={props.payUnitOptions}
                    onText={on.text}
                    onNumber={on.number}
                />
                <Textarea
                    label={copy.jobDescription}
                    rows={4}
                    maxLength={6000}
                    value={values.description}
                    onValueChange={(description) => on.text("description", description)}
                />
                <Heading level={3}>{copy.jobRequirements}</Heading>
                <HiringRequirementFields copy={copy} values={values} onText={on.text} onNumber={on.number} />
                <HiringQuestionList
                    copy={copy}
                    questions={props.questions}
                    typeOptions={props.questionTypeOptions}
                    canAdd={props.canAddQuestion}
                    onPatch={on.patchQuestion}
                    onAdd={on.addQuestion}
                    onRemove={on.removeQuestion}
                />
                <CheckboxGroup
                    label={copy.jobChannels}
                    orientation="horizontal"
                    options={props.channelOptions.map((option) => ({ value: option.id, label: option.label }))}
                    value={values.channels}
                    onValueChange={(channels) => on.list("channels", channels)}
                />
            </Stack>
        </Dialog>
    )
}

interface HiringEditorFooterProps {
    readonly copy: Pick<HiringViews["workbenchCopy"], "cancel" | "jobEditorSave">
    readonly isBusy: boolean
    readonly canSave: boolean
    readonly onClose: () => void
    readonly onSave: () => void
}

/** The original dismiss/save decision remains at the dialog footer with controlled close ownership. */
const HiringEditorFooter = (props: HiringEditorFooterProps) => (
    <>
        <Button intent="dismiss" onPress={props.onClose}>
            {props.copy.cancel}
        </Button>
        <Button
            intent="commit"
            isPending={props.isBusy}
            isDisabled={props.isBusy || !props.canSave}
            onPress={props.onSave}
        >
            {props.copy.jobEditorSave}
        </Button>
    </>
)
