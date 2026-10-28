import {
    Button,
    CheckboxGroup,
    EmptyNotice,
    Input,
    List,
    ListRow,
    NumberField,
    SectionHeader,
    Select,
    SurfaceCard,
    Switch,
    Text,
} from "@starci/grammar/common"
import { BLOCK_CLASS_NAME, FORM_GRID_CLASS_NAME, ROW_CLASS_NAME } from "./classNames"

/** What is typed in the staff form. */
export interface StaffForm {
    /** The person being edited, or `null` for a new one. */
    readonly id: string | null
    readonly name: string
    readonly positionIds: ReadonlyArray<string>
    readonly wage: number
    readonly maxWeek: number
    readonly maxDay: number
    readonly minRest: number
    readonly staffRowId: string | null
    readonly phone: string
    readonly telegramChatId: string
    readonly zaloUserId: string
    readonly active: boolean
}

/** The text fields of the staff form. */
export type StaffTextField = "name" | "phone" | "telegramChatId" | "zaloUserId"

/** The number fields of the staff form. */
export type StaffNumberField = "wage" | "maxWeek" | "maxDay" | "minRest"

/** Copy, people and form state the connected roster card supplies. */
export interface ShiftsStaffBaseProps {
    readonly props: {
        readonly title: string
        readonly hint: string
        readonly emptyTitle: string
        readonly emptyBody: string
        readonly editLabel: string
        readonly formTitle: string
        readonly saveLabel: string
        readonly cancelLabel: string
        readonly labels: {
            readonly name: string
            readonly wage: string
            readonly maxWeek: string
            readonly maxDay: string
            readonly minRest: string
            readonly phone: string
            readonly telegram: string
            readonly zalo: string
            readonly link: string
            readonly positions: string
            readonly active: string
        }
        readonly people: ReadonlyArray<{
            readonly id: string
            readonly title: string
            readonly notes: ReadonlyArray<string>
        }>
        readonly form: StaffForm
        readonly positionOptions: ReadonlyArray<{ readonly value: string; readonly label: string }>
        readonly linkOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
        /** The id of the "not linked" choice of the link select. */
        readonly noLinkId: string
        readonly isBusy: boolean
        readonly canSave: boolean
    }
    readonly on: {
        readonly edit: (id: string) => void
        readonly text: (field: StaffTextField, value: string) => void
        readonly number: (field: StaffNumberField, value: number) => void
        readonly positions: (ids: Array<string>) => void
        readonly link: (id: string) => void
        readonly active: (value: boolean) => void
        readonly save: () => void
        readonly cancel: () => void
    }
}

/** Draws the roster with edit buttons and the form that adds or edits one person. */
export const ShiftsStaffBase = (props: ShiftsStaffBaseProps) => (
    <SurfaceCard label={props.props.title} headingLevel={2}>
        <div className={BLOCK_CLASS_NAME}>
            <Text size="sm" tone="muted">
                {props.props.hint}
            </Text>
            {props.props.people.length === 0 ? (
                <EmptyNotice message={props.props.emptyTitle} description={props.props.emptyBody} />
            ) : (
                renderStaffList({ props })
            )}
            <SectionHeader level={3} title={props.props.formTitle} />
            <div className={FORM_GRID_CLASS_NAME}>
                {renderStaffWorkLimits(props)}
                <Input
                    id="shifts-staff-phone"
                    name="phone"
                    label={props.props.labels.phone}
                    value={props.props.form.phone}
                    onValueChange={(value) => props.on.text("phone", value)}
                />
                <Input
                    id="shifts-staff-telegram"
                    name="telegram"
                    label={props.props.labels.telegram}
                    value={props.props.form.telegramChatId}
                    onValueChange={(value) => props.on.text("telegramChatId", value)}
                />
                <Input
                    id="shifts-staff-zalo"
                    name="zalo"
                    label={props.props.labels.zalo}
                    value={props.props.form.zaloUserId}
                    onValueChange={(value) => props.on.text("zaloUserId", value)}
                />
                <Select
                    label={props.props.labels.link}
                    name="link"
                    value={props.props.form.staffRowId ?? props.props.noLinkId}
                    options={props.props.linkOptions}
                    onValueChange={(value) => props.on.link(value ?? props.props.noLinkId)}
                />
            </div>
            <CheckboxGroup
                label={props.props.labels.positions}
                orientation="horizontal"
                options={props.props.positionOptions}
                value={props.props.form.positionIds}
                onValueChange={props.on.positions}
            />
            {renderStaffActions({ props })}
        </div>
    </SurfaceCard>
)

const renderStaffActions = ({ props }: RenderStaffActionsInput) => (
    <div className={ROW_CLASS_NAME}>
        <Button
            intent="commit"
            isPending={props.props.isBusy}
            isDisabled={!props.props.canSave}
            onPress={props.on.save}
        >
            {props.props.saveLabel}
        </Button>
        {props.props.form.id === null ? null : (
            <>
                <Button intent="neutral" onPress={props.on.cancel}>
                    {props.props.cancelLabel}
                </Button>
                <Switch
                    label={props.props.labels.active}
                    name="active"
                    isSelected={props.props.form.active}
                    onSelectedChange={props.on.active}
                />
            </>
        )}
    </div>
)

const renderStaffList = ({ props }: RenderStaffListInput) => (
    <List label={props.props.title}>
        {props.props.people.map((person) => (
            <ListRow
                key={person.id}
                title={person.title}
                description={person.notes.filter((note) => note !== "").join(" · ")}
                actions={
                    <Button size="sm" intent="neutral" onPress={() => props.on.edit(person.id)}>
                        {props.props.editLabel}
                    </Button>
                }
            />
        ))}
    </List>
)

const renderStaffWorkLimits = (props: ShiftsStaffBaseProps) => (
    <>
        <Input
            id="shifts-staff-name"
            name="name"
            label={props.props.labels.name}
            value={props.props.form.name}
            onValueChange={(value) => props.on.text("name", value)}
        />
        <NumberField
            label={props.props.labels.wage}
            name="wage"
            value={props.props.form.wage}
            minValue={0}
            step={1000}
            onValueChange={(value) => props.on.number("wage", value)}
        />
        <NumberField
            label={props.props.labels.maxWeek}
            name="maxWeek"
            value={props.props.form.maxWeek}
            minValue={1}
            maxValue={100}
            onValueChange={(value) => props.on.number("maxWeek", value)}
        />
        <NumberField
            label={props.props.labels.maxDay}
            name="maxDay"
            value={props.props.form.maxDay}
            minValue={1}
            maxValue={16}
            onValueChange={(value) => props.on.number("maxDay", value)}
        />
        <NumberField
            label={props.props.labels.minRest}
            name="rest"
            value={props.props.form.minRest}
            minValue={0}
            maxValue={24}
            onValueChange={(value) => props.on.number("minRest", value)}
        />
    </>
)

type RenderStaffActionsInput = { props: ShiftsStaffBaseProps }

type RenderStaffListInput = { props: ShiftsStaffBaseProps }
