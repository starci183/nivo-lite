import { Input, Select } from "@starci/grammar/common"
import type { TextFieldItem } from "@/modules/types"

/** A choice of a form among options, with its locally bound update. */
interface ChoiceFieldItem {
    readonly kind: "choice"
    readonly name: string
    readonly label: string
    readonly value: string
    readonly options: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly change: (value: string | null) => void
}

/** One field of the list, a text value or a choice. */
export type FormFieldItem = TextFieldItem | ChoiceFieldItem

/** The ordered fields, the prefix of their ids and the state they share. */
interface FormFieldListProps {
    readonly idPrefix: string
    readonly fields: ReadonlyArray<FormFieldItem>
    readonly isRequired?: boolean
    readonly isDisabled: boolean
    readonly isLoading?: boolean
}

/** Draws the ordered fields of a form without adding a group, grid or other DOM; each caller keeps its own ordering and policy. */
export const FormFieldList = (props: FormFieldListProps) => (
    <>
        {props.fields.map((field) =>
            field.kind === "choice" ? (
                <Select
                    key={field.name}
                    label={field.label}
                    isDisabled={props.isDisabled}
                    value={field.value}
                    options={field.options}
                    onValueChange={field.change}
                    {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                />
            ) : (
                <Input
                    key={field.name}
                    id={`${props.idPrefix}-${field.name}`}
                    name={field.name}
                    label={field.label}
                    value={field.value}
                    {...(field.isSecret === true ? { kind: "password" } : {})}
                    {...(field.description === undefined ? {} : { description: field.description })}
                    {...(props.isRequired === undefined ? {} : { isRequired: props.isRequired })}
                    isDisabled={props.isDisabled}
                    {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                    onValueChange={field.change}
                />
            ),
        )}
    </>
)
