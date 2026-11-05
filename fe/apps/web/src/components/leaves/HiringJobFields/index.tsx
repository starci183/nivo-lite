import { Grid, Input, NumberField, Select, ChoiceChips } from "@starci/grammar/common"

import type { HiringJobFieldCommands, HiringViews } from "@/modules/types"

/** One employment or payment unit choice. */
interface Option {
    readonly id: string
    readonly label: string
}

/** The basic job fields and commands used to edit them. */
interface HiringJobFieldsProps extends HiringJobFieldCommands {
    readonly copy: HiringViews["workbenchCopy"]
    readonly values: Pick<
        HiringViews["jobFormValues"],
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
    readonly copy: HiringViews["workbenchCopy"]
    readonly values: Pick<HiringViews["jobFormValues"], "payMin" | "payMax" | "payUnit">
    readonly options: ReadonlyArray<Option>
    readonly onText: HiringJobFieldsProps["onText"]
    readonly onNumber: HiringJobFieldsProps["onNumber"]
}

/** The place and number of available positions. */
interface PlacementFieldsProps {
    readonly copy: HiringViews["workbenchCopy"]
    readonly values: Pick<HiringViews["jobFormValues"], "location" | "headcount">
    readonly onText: HiringJobFieldsProps["onText"]
    readonly onNumber: HiringJobFieldsProps["onNumber"]
}

/** Draws job title, employment, schedule, pay and staffing fields in their original order. */
export const HiringJobFields = (props: HiringJobFieldsProps) => {
    const { copy, values, onText, onNumber } = props
    return (
        <Grid kind="form" columns={2}>
            <Input
                id="job-title"
                name="title"
                label={copy.jobTitleLabel}
                placeholder={copy.jobTitlePlaceholder}
                isRequired
                value={values.title}
                onValueChange={(title) => onText("title", title)}
            />
            <Input
                id="job-position"
                name="position"
                label={copy.jobPosition}
                value={values.position}
                onValueChange={(position) => onText("position", position)}
            />
            <ChoiceChips
                label={copy.jobEmployment}
                empty={copy.jobEmployment}
                options={props.employmentOptions.map((option) => ({ value: option.id, label: option.label }))}
                value={values.employmentType}
                onValueChange={(type) => onText("employmentType", type)}
            />
            <Input
                id="job-schedule"
                name="schedule"
                label={copy.jobSchedule}
                placeholder={copy.jobSchedulePlaceholder}
                value={values.schedule}
                onValueChange={(schedule) => onText("schedule", schedule)}
            />
            {renderPayFields({ copy, values, options: props.payUnitOptions, onText, onNumber })}
            {renderPlacementFields({ copy, values, onText, onNumber })}
        </Grid>
    )
}

/** The controlled value prop of a number field, absent while the amount is empty. */
const numberValueOf = (amount: number | null): { readonly value?: number } => (amount === null ? {} : { value: amount })

/** Draws the pay interval and its unit. */
const renderPayFields = ({ copy, values, options, onText, onNumber }: PayFieldsProps) => (
    <>
        <NumberField
            label={copy.jobPayMin}
            minValue={0}
            step={500000}
            formatOptions={{ maximumFractionDigits: 0 }}
            {...numberValueOf(values.payMin)}
            onValueChange={(value) => onNumber("payMin", Number.isFinite(value) ? value : null)}
        />
        <NumberField
            label={copy.jobPayMax}
            minValue={0}
            step={500000}
            formatOptions={{ maximumFractionDigits: 0 }}
            {...numberValueOf(values.payMax)}
            onValueChange={(value) => onNumber("payMax", Number.isFinite(value) ? value : null)}
        />
        <Select
            label={copy.jobPayUnit}
            options={options}
            value={values.payUnit}
            onValueChange={(unit) => onText("payUnit", unit ?? "month")}
        />
    </>
)

/** Draws the location and headcount. */
const renderPlacementFields = ({ copy, values, onText, onNumber }: PlacementFieldsProps) => (
    <>
        <Input
            id="job-location"
            name="location"
            label={copy.jobLocation}
            value={values.location}
            onValueChange={(location) => onText("location", location)}
        />
        <NumberField
            label={copy.jobHeadcount}
            minValue={1}
            maxValue={500}
            step={1}
            value={values.headcount}
            onValueChange={(value) => onNumber("headcount", Number.isFinite(value) ? value : 1)}
        />
    </>
)
