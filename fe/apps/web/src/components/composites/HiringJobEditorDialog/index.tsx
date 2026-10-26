import { Alert, Button, CheckboxGroup, Dialog, Heading, Textarea } from "@starci/grammar/common"
import { HiringJobFields } from "@/components/leaves/HiringJobFields"
import type { HiringJobFieldsProps } from "@/components/leaves/HiringJobFields"
import { HiringRequirementFields } from "@/components/branches/HiringRequirementFields"
import { HiringQuestionList } from "@/components/branches/HiringQuestionList"
import type { FieldOf, HiringSay } from "@/hooks/hiring"
import type { HiringJobValues, HiringQuestionValues } from "@/hooks/hiringJobs"
import { FORM_CLASS_NAME } from "./classNames"

/** The words, values and state of the job editor dialog. */
export interface HiringJobEditorDialogProps {
    readonly props: {
        readonly say: HiringSay
        readonly isNew: boolean
        readonly values: HiringJobValues
        readonly employmentOptions: HiringJobFieldsProps["employmentOptions"]
        readonly payUnitOptions: HiringJobFieldsProps["employmentOptions"]
        readonly questionTypeOptions: HiringJobFieldsProps["employmentOptions"]
        readonly channelOptions: HiringJobFieldsProps["employmentOptions"]
        readonly canSave: boolean
        readonly canAddQuestion: boolean
        readonly isBusy: boolean
        readonly error: string | null
    }
    readonly on: {
        readonly text: (name: FieldOf<HiringJobValues, string>, value: string) => void
        readonly number: (name: FieldOf<HiringJobValues, number | null>, value: number | null) => void
        readonly list: (name: FieldOf<HiringJobValues, Array<string>>, value: Array<string>) => void
        readonly patchQuestion: (index: number, patch: Partial<HiringQuestionValues>) => void
        readonly addQuestion: () => void
        readonly removeQuestion: (index: number) => void
        readonly save: () => void
        readonly close: () => void
    }
}

/** The dialog that creates or edits one job post: the post itself, what candidates are screened on, and their questions. */
export const HiringJobEditorDialog = (props: HiringJobEditorDialogProps) => {
    const { say, values, isBusy, error } = props.props
    const { on } = props
    return (
        <Dialog
            isOpen
            onOpenChange={(open) => {
                if (!open) on.close()
            }}
            size="lg"
            title={say(props.props.isNew ? "jobEditorNew" : "jobEditorEdit")}
            closeLabel={say("close")}
            description={say("jobEditorHint")}
            footer={(close) => renderHiringJobEditorDialogFooter(close, say, isBusy, props.props.canSave, on.save)}
        >
            <div className={FORM_CLASS_NAME}>
                {error === null ? null : <Alert tone="negative" title={say("errorNotSaved")} description={error} />}
                <HiringJobFields
                    say={say}
                    values={values}
                    employmentOptions={props.props.employmentOptions}
                    payUnitOptions={props.props.payUnitOptions}
                    onText={on.text}
                    onNumber={on.number}
                />
                <Textarea
                    label={say("jobDescription")}
                    rows={4}
                    maxLength={6000}
                    value={values.description}
                    onValueChange={(description) => on.text("description", description)}
                />
                <Heading level={3}>{say("jobRequirements")}</Heading>
                <HiringRequirementFields say={say} values={values} onText={on.text} onNumber={on.number} />
                <HiringQuestionList
                    say={say}
                    questions={values.questions}
                    typeOptions={props.props.questionTypeOptions}
                    canAdd={props.props.canAddQuestion}
                    onPatch={on.patchQuestion}
                    onAdd={on.addQuestion}
                    onRemove={on.removeQuestion}
                />
                <CheckboxGroup
                    label={say("jobChannels")}
                    orientation="horizontal"
                    options={props.props.channelOptions.map((option) => ({ value: option.id, label: option.label }))}
                    value={values.channels}
                    onValueChange={(channels) => on.list("channels", channels)}
                />
            </div>
        </Dialog>
    )
}

/** Renders the HiringJobEditorDialog footer section. */
const renderHiringJobEditorDialogFooter = (
    close: () => void,
    say: NonNullable<HiringJobEditorDialogProps["props"]["say"]>,
    isBusy: NonNullable<HiringJobEditorDialogProps["props"]["isBusy"]>,
    canSave: boolean,
    save: () => void,
) => (
    <>
        <Button intent="dismiss" onPress={close}>
            {say("cancel")}
        </Button>
        <Button intent="commit" isPending={isBusy} isDisabled={isBusy || !canSave} onPress={save}>
            {say("jobEditorSave")}
        </Button>
    </>
)
