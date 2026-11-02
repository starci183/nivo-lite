import type { ShiftsSetupViews, ShiftsSetupActions } from "@/modules/types"
type ShiftsStaffProps = ShiftsSetupViews["staff"] & {
    readonly on: ShiftsSetupActions["staff"] | undefined
    readonly isLoading?: boolean
}
import {
    Button,
    CheckboxGroup,
    Cluster,
    EmptyNotice,
    Grid,
    Input,
    NumberField,
    Select,
    SurfaceCard,
    Stack,
    Switch,
    Text,
} from "@starci/grammar/common"

/** Draws the roster with edit buttons and the form that adds or edits one person. */
export const ShiftsStaff = (props: ShiftsStaffProps) => (
    <Stack gap="section">
        {renderStaffList(props)}
        <SurfaceCard
            {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
            label={props.formTitle}
            headingLevel={2}
        >
            <Stack gap="row">
                <Grid kind="form" columns={2}>
                    {renderStaffWorkLimits(props)}
                    <Input
                        {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                        id="shifts-staff-phone"
                        name="phone"
                        label={props.labels.phone}
                        value={props.form.phone}
                        onValueChange={(value) => props.on?.text("phone", value)}
                    />
                    <Input
                        {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                        id="shifts-staff-telegram"
                        name="telegram"
                        label={props.labels.telegram}
                        value={props.form.telegramChatId}
                        onValueChange={(value) => props.on?.text("telegramChatId", value)}
                    />
                    <Input
                        {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                        id="shifts-staff-zalo"
                        name="zalo"
                        label={props.labels.zalo}
                        value={props.form.zaloUserId}
                        onValueChange={(value) => props.on?.text("zaloUserId", value)}
                    />
                    <Select
                        {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                        label={props.labels.link}
                        name="link"
                        value={props.form.staffRowId ?? props.noLinkId}
                        options={props.linkOptions}
                        onValueChange={(value) => props.on?.link(value ?? props.noLinkId)}
                    />
                </Grid>
                <CheckboxGroup
                    {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                    label={props.labels.positions}
                    orientation="horizontal"
                    options={props.positionOptions}
                    value={props.form.positionIds}
                    {...(props.on === undefined ? {} : { onValueChange: props.on.positions })}
                />
                {renderStaffActions({ props })}
            </Stack>
        </SurfaceCard>
    </Stack>
)

const renderStaffActions = ({ props }: RenderStaffActionsInput) => (
    <Cluster gap="row">
        <Button
            {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
            intent="commit"
            isPending={props.isBusy}
            isDisabled={!props.canSave}
            {...(props.on === undefined ? {} : { onPress: props.on.save })}
        >
            {props.saveLabel}
        </Button>
        {props.form.id === null ? null : (
            <>
                <Button
                    {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                    intent="neutral"
                    {...(props.on === undefined ? {} : { onPress: props.on.cancel })}
                >
                    {props.cancelLabel}
                </Button>
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

const renderStaffList = (props: ShiftsStaffProps) => (
    <SurfaceCard
        {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
        kind="list"
        label={props.title}
        headingLevel={2}
        footer={
            <Text {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })} size="sm" tone="muted">
                {props.hint}
            </Text>
        }
        empty={<EmptyNotice message={props.emptyTitle} description={props.emptyBody} />}
        items={props.people.map((person) => ({
            id: person.id,
            title: person.title,
            description: person.notes.filter((note) => note !== "").join(" · "),
            action: { label: props.editLabel, press: () => props.on?.edit(person.id) },
        }))}
    />
)

const renderStaffWorkLimits = (props: ShiftsStaffProps) => (
    <>
        <Input
            {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
            id="shifts-staff-name"
            name="name"
            label={props.labels.name}
            value={props.form.name}
            onValueChange={(value) => props.on?.text("name", value)}
        />
        <NumberField
            {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
            label={props.labels.wage}
            name="wage"
            value={props.form.wage}
            minValue={0}
            step={1000}
            onValueChange={(value) => props.on?.number("wage", value)}
        />
        <NumberField
            {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
            label={props.labels.maxWeek}
            name="maxWeek"
            value={props.form.maxWeek}
            minValue={1}
            maxValue={100}
            onValueChange={(value) => props.on?.number("maxWeek", value)}
        />
        <NumberField
            {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
            label={props.labels.maxDay}
            name="maxDay"
            value={props.form.maxDay}
            minValue={1}
            maxValue={16}
            onValueChange={(value) => props.on?.number("maxDay", value)}
        />
        <NumberField
            {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
            label={props.labels.minRest}
            name="rest"
            value={props.form.minRest}
            minValue={0}
            maxValue={24}
            onValueChange={(value) => props.on?.number("minRest", value)}
        />
    </>
)

type RenderStaffActionsInput = { props: ShiftsStaffProps }
