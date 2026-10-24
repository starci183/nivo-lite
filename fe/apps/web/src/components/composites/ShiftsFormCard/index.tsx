import { Badge, Button, Input, List, ListItem, Select, SurfaceCard, Switch, Text } from "@starci/grammar/common"
import {
    BLOCK_CLASS_NAME,
    FORM_GRID_CLASS_NAME,
    LIST_CLASS_NAME,
    LIST_ITEM_CLASS_NAME,
    ROW_CLASS_NAME,
} from "./classNames"

/** One field of the form: a select (it has options) or a text input (it has none). */
interface ShiftsFieldView {
    readonly id: string
    readonly label: string
    readonly value: string
    readonly options: ReadonlyArray<{ readonly id: string; readonly label: string }>
}

/** One row of the list under the form: its text, then a state badge or an action button. */
interface ShiftsFormRowView {
    readonly id: string
    readonly text: string
    readonly badge: { readonly tone: "success" | "neutral" | "warning"; readonly label: string } | null
    readonly actionLabel: string | null
}

/** What the form card shows. */
export interface ShiftsFormView {
    readonly title: string
    readonly hint: string
    readonly fields: ReadonlyArray<ShiftsFieldView>
    /** The wording of the switch for its current state, or `null` when the form has none. */
    readonly switchLabel: string | null
    readonly switchOn: boolean
    readonly submitLabel: string
    readonly submitVariant: "primary" | "outline"
    readonly isBusy: boolean
    readonly canSubmit: boolean
    readonly rows: ReadonlyArray<ShiftsFormRowView>
}

/** The form view plus what its controls do. */
interface ShiftsFormCardProps extends ShiftsFormView {
    readonly onField: (id: string, value: string) => void
    readonly onSwitch?: (value: boolean) => void
    readonly onSubmit: () => void
    readonly onRowAction?: (id: string) => void
}

/** A card with a hint, a grid of selects and text fields, an optional switch, one submit button and a list of rows with a badge or an action. */
export const ShiftsFormCard = (props: ShiftsFormCardProps) => (
    <SurfaceCard label={props.title} headingLevel={2}>
        <div className={BLOCK_CLASS_NAME}>
            <Text size="sm" tone="muted">
                {props.hint}
            </Text>
            <div className={FORM_GRID_CLASS_NAME}>
                {props.fields.map((field) =>
                    field.options.length === 0 ? (
                        <Input
                            key={field.id}
                            id={`shifts-field-${field.id}`}
                            name={field.id}
                            label={field.label}
                            variant="secondary"
                            value={field.value}
                            onValueChange={(value) => props.onField(field.id, value)}
                        />
                    ) : (
                        <Select
                            key={field.id}
                            label={field.label}
                            name={field.id}
                            variant="secondary"
                            value={field.value === "" ? null : field.value}
                            options={field.options}
                            onValueChange={(value) => props.onField(field.id, value ?? "")}
                        />
                    ),
                )}
            </div>
            <div className={ROW_CLASS_NAME}>
                {props.switchLabel === null ? null : (
                    <Switch
                        label={props.switchLabel}
                        name="shifts-switch"
                        isSelected={props.switchOn}
                        {...(props.onSwitch !== undefined && { onSelectedChange: props.onSwitch })}
                    />
                )}
                <Button
                    variant={props.submitVariant}
                    isPending={props.isBusy}
                    isDisabled={!props.canSubmit}
                    onPress={props.onSubmit}
                >
                    {props.submitLabel}
                </Button>
            </div>
            {props.rows.length === 0 ? null : (
                <List label={props.title} className={LIST_CLASS_NAME}>
                    {props.rows.map((row) => (
                        <ListItem key={row.id} className={LIST_ITEM_CLASS_NAME}>
                            <Text size="sm">{row.text}</Text>
                            {row.badge === null ? null : <Badge tone={row.badge.tone}>{row.badge.label}</Badge>}
                            {row.actionLabel === null ? null : (
                                <Button size="sm" variant="ghost" onPress={() => props.onRowAction?.(row.id)}>
                                    {row.actionLabel}
                                </Button>
                            )}
                        </ListItem>
                    ))}
                </List>
            )}
        </div>
    </SurfaceCard>
)
