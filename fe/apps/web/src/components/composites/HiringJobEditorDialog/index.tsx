import {
    Alert,
    Button,
    CheckboxGroup,
    Dialog,
    Heading,
    Input,
    NumberField,
    SegmentedControl,
    Select,
    Textarea,
} from "@starci/grammar/common"
import { HiringRequirementFields } from "@/components/branches/HiringRequirementFields"
import { HiringQuestionList } from "@/components/branches/HiringQuestionList"
import type { FieldOf, HiringSay } from "@/hooks/hiring"
import type { HiringJobValues, HiringQuestionValues } from "@/hooks/hiringJobs"
import { FORM_CLASS_NAME, GRID_CLASS_NAME } from "./classNames"

/** One option of a choice field. */
interface Option {
    readonly id: string
    readonly label: string
}

/** The words, values and state of the job editor dialog. */
export interface HiringJobEditorDialogProps {
    readonly props: {
        readonly say: HiringSay
        readonly isNew: boolean
        readonly values: HiringJobValues
        readonly employmentOptions: ReadonlyArray<Option>
        readonly payUnitOptions: ReadonlyArray<Option>
        readonly questionTypeOptions: ReadonlyArray<Option>
        readonly channelOptions: ReadonlyArray<Option>
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

const numberOrNull = (value: number): number | null => (Number.isFinite(value) ? value : null)

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
            footer={(close) => (
                <>
                    <Button variant="tertiary" onPress={close}>
                        {say("cancel")}
                    </Button>
                    <Button
                        variant="primary"
                        isPending={isBusy}
                        isDisabled={isBusy || !props.props.canSave}
                        onPress={on.save}
                    >
                        {say("jobEditorSave")}
                    </Button>
                </>
            )}
        >
            <div className={FORM_CLASS_NAME}>
                {error === null ? null : <Alert tone="negative" title={say("errorNotSaved")} description={error} />}
                <div className={GRID_CLASS_NAME}>
                    <Input
                        id="job-title"
                        name="title"
                        label={say("jobTitleLabel")}
                        placeholder={say("jobTitlePlaceholder")}
                        variant="secondary"
                        isRequired
                        value={values.title}
                        onValueChange={(title) => on.text("title", title)}
                    />
                    <Input
                        id="job-position"
                        name="position"
                        label={say("jobPosition")}
                        variant="secondary"
                        value={values.position}
                        onValueChange={(position) => on.text("position", position)}
                    />
                    <SegmentedControl
                        label={say("jobEmployment")}
                        options={props.props.employmentOptions.map((option) => ({
                            value: option.id,
                            label: option.label,
                        }))}
                        value={values.employmentType}
                        onValueChange={(type) => on.text("employmentType", type)}
                    />
                    <Input
                        id="job-schedule"
                        name="schedule"
                        label={say("jobSchedule")}
                        placeholder={say("jobSchedulePlaceholder")}
                        variant="secondary"
                        value={values.schedule}
                        onValueChange={(schedule) => on.text("schedule", schedule)}
                    />
                    <NumberField
                        variant="secondary"
                        label={say("jobPayMin")}
                        minValue={0}
                        step={500000}
                        formatOptions={{ maximumFractionDigits: 0 }}
                        value={values.payMin ?? undefined}
                        onValueChange={(value) => on.number("payMin", numberOrNull(value))}
                    />
                    <NumberField
                        variant="secondary"
                        label={say("jobPayMax")}
                        minValue={0}
                        step={500000}
                        formatOptions={{ maximumFractionDigits: 0 }}
                        value={values.payMax ?? undefined}
                        onValueChange={(value) => on.number("payMax", numberOrNull(value))}
                    />
                    <Select
                        variant="secondary"
                        label={say("jobPayUnit")}
                        options={props.props.payUnitOptions}
                        value={values.payUnit}
                        onValueChange={(unit) => on.text("payUnit", unit ?? "month")}
                    />
                    <Input
                        id="job-location"
                        name="location"
                        label={say("jobLocation")}
                        variant="secondary"
                        value={values.location}
                        onValueChange={(location) => on.text("location", location)}
                    />
                    <NumberField
                        variant="secondary"
                        label={say("jobHeadcount")}
                        minValue={1}
                        maxValue={500}
                        step={1}
                        value={values.headcount}
                        onValueChange={(value) => on.number("headcount", Number.isFinite(value) ? value : 1)}
                    />
                </div>
                <Textarea
                    variant="secondary"
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
                    variant="secondary"
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
