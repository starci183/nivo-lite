import { Input } from "@starci/grammar/common"

/** A text value of a database or mailbox connection, with its locally bound field update. */
interface ConnectionAccountInput {
    readonly name: "name" | "email" | "host" | "port" | "database" | "user" | "password"
    readonly label: string
    readonly value: string
    readonly description?: string
    readonly change: (value: string) => void
}

/** Only text fields are shared: each wizard retains its own engine/provider/security controls and ordering. */
interface ConnectionAccountInputsProps {
    readonly owner: "db" | "imap"
    readonly fields: ReadonlyArray<ConnectionAccountInput>
    readonly isDisabled: boolean
    readonly isLoading?: boolean
}

/** Draws the ordered connection text values without adding a group, grid or other DOM. */
export const ConnectionAccountInputs = (props: ConnectionAccountInputsProps) => (
    <>
        {props.fields.map((field) => (
            <Input
                key={field.name}
                id={`${props.owner}-${field.name}`}
                name={field.name}
                label={field.label}
                value={field.value}
                {...(field.name === "password" ? { kind: "password" } : {})}
                {...(field.description === undefined ? {} : { description: field.description })}
                isDisabled={props.isDisabled}
                {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                onValueChange={field.change}
            />
        ))}
    </>
)
