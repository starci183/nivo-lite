import { Alert, RadioGroup, Grid } from "@starci/grammar/common"
import { FormFieldList, type FormFieldItem } from "@/components/leaves/FormFieldList"
import { textFieldsOf } from "@/modules/types"

/** A text field of the database connect form. */
type DatabaseTextField = "name" | "host" | "port" | "database" | "user" | "password"

/** What the connect step draws: the read-only advice, the target fields and the SSL choice. */
export interface DatabaseConnectFieldsProps {
    readonly props: {
        readonly isLoading?: boolean

        readonly values: Readonly<Record<DatabaseTextField | "engine", string>>
        readonly ssl: "on" | "off"
        readonly engines: ReadonlyArray<{ readonly id: string; readonly label: string }>
        /** The hint under the password when one is already saved; undefined otherwise. */
        readonly passwordHint: string | undefined
        readonly isDisabled: boolean
        readonly text: Readonly<
            Record<
                | "readOnlyTitle"
                | "readOnlyBody"
                | "name"
                | "nameHint"
                | "engine"
                | "host"
                | "hostHint"
                | "port"
                | "database"
                | "user"
                | "password"
                | "ssl"
                | "sslRequire"
                | "sslOff",
                string
            >
        >
    }
    readonly on: {
        readonly field: (field: DatabaseTextField) => (value: string) => void
        readonly engine: (value: string | null) => void
        readonly ssl: (on: boolean) => void
    }
}

/** The text and choice fields of the connect step, in the order they are drawn. */
const fieldsOf = (
    view: DatabaseConnectFieldsProps["props"],
    on: DatabaseConnectFieldsProps["on"],
): ReadonlyArray<FormFieldItem> => {
    const source = { text: view.text, values: view.values, field: on.field }
    return [
        ...textFieldsOf(["name"], source, { name: { description: view.text.nameHint } }),
        {
            kind: "choice",
            name: "engine",
            label: view.text.engine,
            value: view.values.engine,
            options: view.engines,
            change: on.engine,
        },
        ...textFieldsOf(["host", "port", "database", "user", "password"], source, {
            host: { description: view.text.hostHint },
            password: {
                isSecret: true,
                ...(view.passwordHint === undefined ? {} : { description: view.passwordHint }),
            },
        }),
    ]
}

/** Connect step of the database wizard: a read-only user is advised, then the server, database and sign-in. */
export const DatabaseConnectFields = (props: DatabaseConnectFieldsProps) => {
    const { props: view, on } = props
    return (
        <>
            <Alert tone="informative" title={view.text.readOnlyTitle} description={view.text.readOnlyBody} />
            <Grid kind="form" columns={2}>
                <FormFieldList
                    idPrefix="db"
                    fields={fieldsOf(view, on)}
                    isDisabled={view.isDisabled}
                    {...(view.isLoading === undefined ? {} : { isLoading: view.isLoading })}
                />
            </Grid>
            <RadioGroup
                {...(view.isLoading === undefined ? {} : { isLoading: view.isLoading })}
                label={view.text.ssl}
                isDisabled={view.isDisabled}
                value={view.ssl}
                onValueChange={(value) => on.ssl(value !== "off")}
                options={[
                    { value: "on", label: view.text.sslRequire },
                    { value: "off", label: view.text.sslOff },
                ]}
            />
        </>
    )
}
