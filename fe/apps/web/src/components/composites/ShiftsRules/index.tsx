import type { ShiftsSetupViews, ShiftsSetupActions } from "@/modules/types"
type ShiftsRulesProps = ShiftsSetupViews["rules"] & {
    readonly on: ShiftsSetupActions["rules"] | undefined
    readonly isLoading?: boolean
}
import {
    Badge,
    Button,
    NumberField,
    Section,
    Select,
    SurfaceCard,
    Switch,
    Text,
    Stack,
    Grid,
    Cluster,
} from "@starci/grammar/common"

/** Draws the numeric rules, the opening hours of each weekday and the reminder state. */
export const ShiftsRules = (props: ShiftsRulesProps) => (
    <SurfaceCard
        {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
        label={props.title}
        headingLevel={2}
    >
        <Stack gap="row">
            <Text {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })} size="sm" tone="muted">
                {props.hint}
            </Text>
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
                            {day.isOpen ? (
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
                            ) : (
                                <Text
                                    {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                                    size="xs"
                                    tone="muted"
                                >
                                    {props.closedLabel}
                                </Text>
                            )}
                        </Cluster>
                    ))}
                </Grid>
            </Section>
            <Cluster gap="row">
                <Button
                    {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                    intent="commit"
                    isPending={props.isBusy}
                    {...(props.on === undefined ? {} : { onPress: props.on.save })}
                >
                    {props.saveLabel}
                </Button>
                <Badge
                    {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                    tone={props.reminderOn ? "success" : "neutral"}
                >
                    {props.reminderLabel}
                </Badge>
            </Cluster>
            {props.reminderHint === "" ? null : (
                <Text {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })} size="xs" tone="muted">
                    {props.reminderHint}
                </Text>
            )}
        </Stack>
    </SurfaceCard>
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
