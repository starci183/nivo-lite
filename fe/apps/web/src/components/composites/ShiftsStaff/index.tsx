import type { ShiftsSetupViews, ShiftsSetupActions } from "@/modules/types"
type ShiftsStaffProps = ShiftsSetupViews["staff"] & {
    readonly on: ShiftsSetupActions["staff"] | undefined
    readonly isLoading?: boolean
}
import {
    Cluster,
    EmptyNotice,
    Grid,
    Input,
    NumberField,
    Select,
    SurfaceCard,
    Stack,
    Switch,
} from "@starci/grammar/common"
import { ShiftsListCard } from "@/components/branches/ShiftsListCard"
import { ShiftsActionButton } from "@/components/leaves/ShiftsActionButton"
import { ShiftsCheckboxes } from "@/components/leaves/ShiftsCheckboxes"

/** One text input of the person form: its id and name, the label it reads and the field of the form it edits. */
interface StaffTextField {
    readonly id: string
    readonly name: string
    readonly labelKey: "name" | "phone" | "telegram" | "zalo"
    readonly formKey: ShiftsSetupViews["staffStaffTextField"]
}

/** The name opens the form; the contacts follow the limits. */
const NAME_FIELDS: ReadonlyArray<StaffTextField> = [
    { id: "shifts-staff-name", name: "name", labelKey: "name", formKey: "name" },
]
const CONTACT_FIELDS: ReadonlyArray<StaffTextField> = [
    { id: "shifts-staff-phone", name: "phone", labelKey: "phone", formKey: "phone" },
    { id: "shifts-staff-telegram", name: "telegram", labelKey: "telegram", formKey: "telegramChatId" },
    { id: "shifts-staff-zalo", name: "zalo", labelKey: "zalo", formKey: "zaloUserId" },
]

/** The number fields of the person form, with the bounds of each. */
const NUMBER_FIELDS = [
    { name: "wage", labelKey: "wage", formKey: "wage", bounds: { minValue: 0, step: 1000 } },
    { name: "maxWeek", labelKey: "maxWeek", formKey: "maxWeek", bounds: { minValue: 1, maxValue: 100 } },
    { name: "maxDay", labelKey: "maxDay", formKey: "maxDay", bounds: { minValue: 1, maxValue: 16 } },
    { name: "rest", labelKey: "minRest", formKey: "minRest", bounds: { minValue: 0, maxValue: 24 } },
] as const

/** Draws the roster with edit buttons and the form that adds or edits one person. */
export const ShiftsStaff = (props: ShiftsStaffProps) => (
    <Stack gap="section">
        <ShiftsListCard
            title={props.title}
            hint={props.hint}
            isLoading={props.isLoading}
            empty={<EmptyNotice message={props.emptyTitle} description={props.emptyBody} />}
            items={props.people.map((person) => ({
                id: person.id,
                title: person.title,
                description: person.notes.filter((note) => note !== "").join(" · "),
                action: { label: props.editLabel, press: () => props.on?.edit(person.id) },
            }))}
        />
        <SurfaceCard
            {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
            label={props.formTitle}
            headingLevel={2}
        >
            <Stack gap="row">
                <Grid kind="form" columns={2}>
                    {renderStaffTextFields(props, NAME_FIELDS)}
                    {renderStaffNumberFields(props)}
                    {renderStaffTextFields(props, CONTACT_FIELDS)}
                    <Select
                        {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                        label={props.labels.link}
                        name="link"
                        value={props.form.staffRowId ?? props.noLinkId}
                        options={props.linkOptions}
                        onValueChange={(value) => props.on?.link(value ?? props.noLinkId)}
                    />
                </Grid>
                <ShiftsCheckboxes
                    label={props.labels.positions}
                    options={props.positionOptions}
                    value={props.form.positionIds}
                    onValueChange={props.on?.positions}
                    isLoading={props.isLoading}
                />
                {renderStaffActions({ props })}
            </Stack>
        </SurfaceCard>
    </Stack>
)

const renderStaffActions = ({ props }: RenderStaffActionsInput) => (
    <Cluster gap="row">
        <ShiftsActionButton
            isLoading={props.isLoading}
            intent="commit"
            isPending={props.isBusy}
            isDisabled={!props.canSave}
            onPress={props.on?.save}
            label={props.saveLabel}
        />
        {props.form.id === null ? null : (
            <>
                <ShiftsActionButton
                    isLoading={props.isLoading}
                    intent="neutral"
                    onPress={props.on?.cancel}
                    label={props.cancelLabel}
                />
                <Switch
                    {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                    label={props.labels.active}
                    name="active"
                    isSelected={props.form.active}
                    {...(props.on === undefined ? {} : { onSelectedChange: props.on.active })}
                />
            </>
        )}
    </Cluster>
)

const renderStaffTextFields = (props: ShiftsStaffProps, fields: ReadonlyArray<StaffTextField>) =>
    fields.map((field) => (
        <Input
            {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
            key={field.id}
            id={field.id}
            name={field.name}
            label={props.labels[field.labelKey]}
            value={props.form[field.formKey]}
            onValueChange={(value) => props.on?.text(field.formKey, value)}
        />
    ))

const renderStaffNumberFields = (props: ShiftsStaffProps) =>
    NUMBER_FIELDS.map((field) => (
        <NumberField
            {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
            key={field.name}
            label={props.labels[field.labelKey]}
            name={field.name}
            value={props.form[field.formKey]}
            {...field.bounds}
            onValueChange={(value) => props.on?.number(field.formKey, value)}
        />
    ))

type RenderStaffActionsInput = { props: ShiftsStaffProps }
