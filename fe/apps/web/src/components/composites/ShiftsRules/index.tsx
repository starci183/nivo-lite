import type { ShiftsSetupViews, ShiftsSetupActions } from "@/modules/types"
type ShiftsRulesProps = ShiftsSetupViews["rules"] & {
    readonly on: ShiftsSetupActions["rules"] | undefined
    readonly isLoading?: boolean
}
import { Badge, NumberField, Section, Select, Switch, Text, Grid, Cluster } from "@starci/grammar/common"
import { ShiftsSetupCard } from "@/components/branches/ShiftsSetupCard"
import { ShiftsActionButton } from "@/components/leaves/ShiftsActionButton"

/** Draws the numeric rules, the opening hours of each weekday and the reminder state. */
export const ShiftsRules = (props: ShiftsRulesProps) => (
    <ShiftsSetupCard
        title={props.title}
        hint={props.hint}
        isLoading={props.isLoading}
        body={
            <>
                <Grid kind="form" columns={2}>
                    {fieldsOf(props).map((field) => (
                        <NumberField
                            {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                            key={field.id}
                            label={field.label}
                            name={`rule-${field.id}`}
                            value={field.value}
                            minValue={field.min}
                            maxValue={field.max}
                            onValueChange={(value) => props.on?.rule(field.id, value)}
                        />
                    ))}
                </Grid>
                <Section
                    {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                    headingLevel={3}
                    title={props.hoursTitle}
                >
                    <Grid kind="form" columns={2}>
                        {daysOf(props).map((day) => (
                            <Cluster key={day.id} gap="row">
                                <Switch
                                    {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                                    label={day.label}
                                    name={`open-${day.id}`}
                                    isSelected={day.isOpen}
                                    onSelectedChange={(value) => props.on?.toggle(day.id, value)}
                                />
                                {day.isOpen ? renderEnds(props, day) : renderClosed(props)}
                            </Cluster>
                        ))}
                    </Grid>
                </Section>
                <Cluster gap="row">
                    <ShiftsActionButton
                        isLoading={props.isLoading}
                        intent="commit"
                        isPending={props.isBusy}
                        onPress={props.on?.save}
                        label={props.saveLabel}
                    />
                    <Badge
                        {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                        tone={props.reminderOn ? "success" : "neutral"}
                    >
                        {props.reminderLabel}
                    </Badge>
                </Cluster>
                {props.reminderHint === "" ? null : (
                    <Text
                        {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                        size="xs"
                        tone="muted"
                    >
                        {props.reminderHint}
                    </Text>
                )}
            </>
        }
    />
)

type RulesDay = ReturnType<typeof daysOf>[number]

/** The opening and closing time selects of an open weekday. */
const renderEnds = (props: Pick<ShiftsRulesProps, "isLoading" | "timeOptions" | "on">, day: RulesDay) =>
    day.ends.map((end) => (
        <Select
            {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
            key={end.id}
            label={end.label}
            isLabelHidden
            name={`${end.id}-${day.id}`}
            value={end.value}
            options={props.timeOptions}
            onValueChange={(value) => props.on?.end(day.id, end.id, value ?? end.value)}
        />
    ))

/** The note that a weekday is closed. */
const renderClosed = (props: Pick<ShiftsRulesProps, "isLoading" | "closedLabel">) => (
    <Text {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })} size="xs" tone="muted">
        {props.closedLabel}
    </Text>
)

const fieldsOf = (props: ShiftsRulesProps) =>
    props.fieldStructure.map((field) => ({
        ...field,
        value: props.fields.find((item) => item.id === field.id)?.value ?? 0,
    }))
const daysOf = (props: ShiftsRulesProps) =>
    props.dayStructure.map(
        (day) =>
            props.days.find((item) => item.id === day.id) ?? {
                ...day,
                isOpen: false,
                ends: [
                    { id: "open", label: props.openingLabel, value: "" },
                    { id: "close", label: props.closingLabel, value: "" },
                ],
            },
    )
