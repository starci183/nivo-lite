import { Time } from "@internationalized/date"
import { Button, Divider, Input, NumberField, Region, Switch, Text, TimeField } from "@starci/grammar/common"
import { ACTIONS_CLASS, FIELDS_CLASS, SECTION_CLASS } from "./classNames"

/** What every setting field carries. */
type FieldBase = {
    readonly key: string
    readonly id: string
    readonly label: string
    readonly description?: string
}

/** One setting of a template as the form edits it. */
type AutomationSettingField =
    | (FieldBase & { readonly kind: "number"; readonly min: number; readonly max: number; readonly value: number })
    | (FieldBase & { readonly kind: "time"; readonly hour: number; readonly minute: number })
    | (FieldBase & { readonly kind: "toggle"; readonly isOn: boolean })
    | (FieldBase & { readonly kind: "text"; readonly maxLength?: number; readonly value: string })

/** A value the form hands back for a setting. */
type AutomationSettingValue = string | number | boolean

/** What the settings form shows. */
type AutomationSettingsProps = {
    readonly sectionLabel: string
    readonly fields: ReadonlyArray<AutomationSettingField>
    readonly saveLabel: string
    readonly savedText?: string
    readonly isBusy: boolean
    readonly onChange: (key: string, value: AutomationSettingValue) => void
    readonly onSave: () => void
}

/** What one field needs to draw itself. */
type FieldViewProps = {
    readonly field: AutomationSettingField
    readonly isBusy: boolean
    readonly onChange: (key: string, value: AutomationSettingValue) => void
}

const pad = (value: number): string => String(value).padStart(2, "0")

const FieldView = (props: FieldViewProps) => {
    const { field, isBusy, onChange } = props
    if (field.kind === "number") {
        return (
            <NumberField
                id={field.id}
                name={field.key}
                label={field.label}
                description={field.description}
                minValue={field.min}
                maxValue={field.max}
                value={field.value}
                isDisabled={isBusy}
                onValueChange={(value) => onChange(field.key, Number.isFinite(value) ? value : field.min)}
            />
        )
    }
    if (field.kind === "time") {
        return (
            <TimeField
                name={field.key}
                label={field.label}
                description={field.description}
                granularity="minute"
                hourCycle={24}
                value={new Time(field.hour, field.minute)}
                isDisabled={isBusy}
                onValueChange={(value) => {
                    if (value) onChange(field.key, `${pad(value.hour)}:${pad(value.minute)}`)
                }}
            />
        )
    }
    if (field.kind === "toggle") {
        return (
            <Switch
                name={field.key}
                label={field.label}
                description={field.description}
                isSelected={field.isOn}
                isDisabled={isBusy}
                onSelectedChange={(value) => onChange(field.key, value)}
            />
        )
    }
    return (
        <Input
            id={field.id}
            name={field.key}
            label={field.label}
            description={field.description}
            value={field.value}
            isDisabled={isBusy}
            onValueChange={(value) =>
                onChange(field.key, field.maxLength === undefined ? value : value.slice(0, field.maxLength))
            }
        />
    )
}

/** The settings of a template (numbers, text, a time, a yes/no), straight from its definition; nothing when it has none. */
export const AutomationSettings = (props: AutomationSettingsProps) =>
    props.fields.length === 0 ? null : (
        <Region className={SECTION_CLASS} label={props.sectionLabel}>
            <Divider semantics="presentation" />
            <div className={FIELDS_CLASS}>
                {props.fields.map((field) => (
                    <FieldView key={field.key} field={field} isBusy={props.isBusy} onChange={props.onChange} />
                ))}
            </div>
            <div className={ACTIONS_CLASS}>
                <Button intent="neutral" isPending={props.isBusy} onPress={props.onSave}>
                    {props.saveLabel}
                </Button>
                {props.savedText === undefined ? null : (
                    <Text size="sm" live="polite">
                        {props.savedText}
                    </Text>
                )}
            </div>
        </Region>
    )
