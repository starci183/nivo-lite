import { Badge, Button, NumberField, SectionHeader, Select, SurfaceCard, Switch, Text } from "@starci/grammar/common"
import { BLOCK_CLASS_NAME, FORM_GRID_CLASS_NAME, HOURS_GRID_CLASS_NAME, ROW_CLASS_NAME } from "./classNames"

/** The numeric rules of the shop. */
export type RuleField = "swap" | "leave" | "remind" | "noshow" | "overtime"

/** One select choice. */
interface OptionView {
    readonly id: string
    readonly label: string
}

/** Copy, rules and opening hours the connected rules card supplies. */
export interface ShiftsRulesBaseProps {
    readonly props: {
        readonly title: string
        readonly hint: string
        readonly hoursTitle: string
        readonly closedLabel: string
        readonly saveLabel: string
        readonly reminderLabel: string
        /** Why reminders are off, or empty when they are on. */
        readonly reminderHint: string
        readonly reminderOn: boolean
        readonly fields: ReadonlyArray<{
            readonly id: RuleField
            readonly label: string
            readonly value: number
            readonly min: number
            readonly max: number
        }>
        readonly days: ReadonlyArray<{
            readonly id: string
            readonly label: string
            readonly isOpen: boolean
            /** The opening and the closing time with their labels. */
            readonly ends: ReadonlyArray<{ readonly id: string; readonly label: string; readonly value: string }>
        }>
        readonly timeOptions: ReadonlyArray<OptionView>
        readonly isBusy: boolean
    }
    readonly on: {
        readonly rule: (field: RuleField, value: number) => void
        readonly toggle: (day: string, isOpen: boolean) => void
        readonly end: (day: string, end: string, value: string) => void
        readonly save: () => void
    }
}

/** Draws the numeric rules, the opening hours of each weekday and the reminder state. */
export const ShiftsRulesBase = (props: ShiftsRulesBaseProps) => (
    <SurfaceCard label={props.props.title} headingLevel={2}>
        <div className={BLOCK_CLASS_NAME}>
            <Text size="sm" tone="muted">
                {props.props.hint}
            </Text>
            <div className={FORM_GRID_CLASS_NAME}>
                {props.props.fields.map((field) => (
                    <NumberField
                        key={field.id}
                        label={field.label}
                        name={`rule-${field.id}`}
                        value={field.value}
                        minValue={field.min}
                        maxValue={field.max}
                        onValueChange={(value) => props.on.rule(field.id, value)}
                    />
                ))}
            </div>
            <SectionHeader level={3} title={props.props.hoursTitle} />
            <div className={HOURS_GRID_CLASS_NAME}>
                {props.props.days.map((day) => (
                    <div key={day.id} className={ROW_CLASS_NAME}>
                        <Switch
                            label={day.label}
                            name={`open-${day.id}`}
                            isSelected={day.isOpen}
                            onSelectedChange={(value) => props.on.toggle(day.id, value)}
                        />
                        {day.isOpen ? (
                            day.ends.map((end) => (
                                <Select
                                    key={end.id}
                                    label={end.label}
                                    isLabelHidden
                                    name={`${end.id}-${day.id}`}
                                    value={end.value}
                                    options={props.props.timeOptions}
                                    onValueChange={(value) => props.on.end(day.id, end.id, value ?? end.value)}
                                />
                            ))
                        ) : (
                            <Text size="xs" tone="muted">
                                {props.props.closedLabel}
                            </Text>
                        )}
                    </div>
                ))}
            </div>
            <div className={ROW_CLASS_NAME}>
                <Button intent="commit" isPending={props.props.isBusy} onPress={props.on.save}>
                    {props.props.saveLabel}
                </Button>
                <Badge tone={props.props.reminderOn ? "success" : "neutral"}>{props.props.reminderLabel}</Badge>
            </div>
            {props.props.reminderHint === "" ? null : (
                <Text size="xs" tone="muted">
                    {props.props.reminderHint}
                </Text>
            )}
        </div>
    </SurfaceCard>
)
