/** A text value of a form, with its locally bound update. */
export interface TextFieldItem {
    readonly kind: "text"
    readonly name: string
    readonly label: string
    readonly value: string
    readonly description?: string
    /** The value is a secret: it draws as a password field. */
    readonly isSecret?: boolean
    readonly change: (value: string) => void
}

/** Where a form's text fields find their labels, their values and their updates. */
interface TextFieldSource<Name extends string> {
    readonly text: Readonly<Record<Name, string>>
    readonly values: Readonly<Record<Name, string>>
    readonly field: (name: Name) => (value: string) => void
}

/** What a field adds to its label and value: a line of guidance, or the mark of a secret. */
interface TextFieldExtra {
    readonly description?: string
    readonly isSecret?: boolean
}

/** The text fields of a form for the given names, in that order, with the extras some of them carry. */
export const textFieldsOf = <Name extends string>(
    names: ReadonlyArray<Name>,
    source: TextFieldSource<Name>,
    extras?: Readonly<Partial<Record<Name, TextFieldExtra>>>,
): ReadonlyArray<TextFieldItem> =>
    names.map((name) => ({
        kind: "text",
        name,
        label: source.text[name],
        value: source.values[name],
        ...extras?.[name],
        change: source.field(name),
    }))
