import { Input, NumberField, SegmentedControl, Select } from "@starci/grammar/common"
import type { HiringSay } from "@/hooks/hiring"
import type { HiringJobFieldCommands, HiringJobValues } from "@/hooks/hiringJobs"
import { GRID_CLASS_NAME } from "./classNames"

/** One employment or payment unit choice. */
interface Option {
    readonly id: string
    readonly label: string
}

/** The basic job fields and commands used to edit them. */
export interface HiringJobFieldsProps extends HiringJobFieldCommands {
    readonly say: HiringSay
    readonly values: Pick<
        HiringJobValues,
        | "title"
        | "position"
        | "employmentType"
        | "schedule"
        | "payMin"
        | "payMax"
        | "payUnit"
        | "location"
        | "headcount"
    >
    readonly employmentOptions: ReadonlyArray<Option>
    readonly payUnitOptions: ReadonlyArray<Option>
}

/** Pay amounts and their unit share the same change commands. */
interface PayFieldsProps {
    readonly say: HiringSay
    readonly values: Pick<HiringJobValues, "payMin" | "payMax" | "payUnit">
    readonly options: ReadonlyArray<Option>
    readonly onText: HiringJobFieldsProps["onText"]
    readonly onNumber: HiringJobFieldsProps["onNumber"]
}

/** The place and number of available positions. */
interface PlacementFieldsProps {
    readonly say: HiringSay
    readonly values: Pick<HiringJobValues, "location" | "headcount">
    readonly onText: HiringJobFieldsProps["onText"]
    readonly onNumber: HiringJobFieldsProps["onNumber"]
}

/** Draws job title, employment, schedule, pay and staffing fields in their original order. */
export const HiringJobFields = (props: HiringJobFieldsProps) => {
    const { say, values, onText, onNumber } = props
    return (
        <div className={GRID_CLASS_NAME}>
            <Input
                id="job-title"
                name="title"
                label={say("jobTitleLabel")}
                placeholder={say("jobTitlePlaceholder")}
                variant="secondary"
                isRequired
                value={values.title}
                onValueChange={(title) => onText("title", title)}
            />
            <Input
                id="job-position"
                name="position"
                label={say("jobPosition")}
                variant="secondary"
                value={values.position}
                onValueChange={(position) => onText("position", position)}
            />
            <SegmentedControl
                label={say("jobEmployment")}
                options={props.employmentOptions.map((option) => ({ value: option.id, label: option.label }))}
                value={values.employmentType}
                onValueChange={(type) => onText("employmentType", type)}
            />
            <Input
                id="job-schedule"
                name="schedule"
                label={say("jobSchedule")}
                placeholder={say("jobSchedulePlaceholder")}
                variant="secondary"
                value={values.schedule}
                onValueChange={(schedule) => onText("schedule", schedule)}
            />
            {renderPayFields({ say, values, options: props.payUnitOptions, onText, onNumber })}
            {renderPlacementFields({ say, values, onText, onNumber })}
        </div>
    )
}

/** Draws the pay interval and its unit. */
const renderPayFields = ({ say, values, options, onText, onNumber }: PayFieldsProps) => (
    <>
        <NumberField
            variant="secondary"
            label={say("jobPayMin")}
            minValue={0}
            step={500000}
            formatOptions={{ maximumFractionDigits: 0 }}
            value={values.payMin ?? undefined}
            onValueChange={(value) => onNumber("payMin", Number.isFinite(value) ? value : null)}
        />
        <NumberField
            variant="secondary"
            label={say("jobPayMax")}
            minValue={0}
            step={500000}
            formatOptions={{ maximumFractionDigits: 0 }}
            value={values.payMax ?? undefined}
            onValueChange={(value) => onNumber("payMax", Number.isFinite(value) ? value : null)}
        />
        <Select
            variant="secondary"
            label={say("jobPayUnit")}
            options={options}
            value={values.payUnit}
            onValueChange={(unit) => onText("payUnit", unit ?? "month")}
        />
    </>
)

/** Draws the location and headcount. */
const renderPlacementFields = ({ say, values, onText, onNumber }: PlacementFieldsProps) => (
    <>
        <Input
            id="job-location"
            name="location"
            label={say("jobLocation")}
            variant="secondary"
            value={values.location}
            onValueChange={(location) => onText("location", location)}
        />
        <NumberField
            variant="secondary"
            label={say("jobHeadcount")}
            minValue={1}
            maxValue={500}
            step={1}
            value={values.headcount}
            onValueChange={(value) => onNumber("headcount", Number.isFinite(value) ? value : 1)}
        />
    </>
)
