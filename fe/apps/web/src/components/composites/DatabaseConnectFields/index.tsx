import { Alert, RadioGroup, Select, Grid } from "@starci/grammar/common"
import { ConnectionAccountInputs } from "@/components/leaves/ConnectionAccountInputs"

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

/** Connect step of the database wizard: a read-only user is advised, then the server, database and sign-in. */
export const DatabaseConnectFields = (props: DatabaseConnectFieldsProps) => {
    const { props: view, on } = props
    return (
        <>
            <Alert tone="informative" title={view.text.readOnlyTitle} description={view.text.readOnlyBody} />
            <Grid kind="form" columns={2}>
                <ConnectionAccountInputs
                    owner="db"
                    fields={[
                        {
                            name: "name",
                            label: view.text.name,
                            value: view.values.name,
                            description: view.text.nameHint,
                            change: on.field("name"),
                        },
                    ]}
                    isDisabled={view.isDisabled}
                    {...(view.isLoading === undefined ? {} : { isLoading: view.isLoading })}
                />
                <Select
                    {...(view.isLoading === undefined ? {} : { isLoading: view.isLoading })}
                    label={view.text.engine}
                    isDisabled={view.isDisabled}
                    value={view.values.engine}
                    options={view.engines}
                    onValueChange={on.engine}
                />
                <ConnectionAccountInputs
                    owner="db"
                    fields={[
                        {
                            name: "host",
                            label: view.text.host,
                            value: view.values.host,
                            description: view.text.hostHint,
                            change: on.field("host"),
                        },
                        { name: "port", label: view.text.port, value: view.values.port, change: on.field("port") },
                        {
                            name: "database",
                            label: view.text.database,
                            value: view.values.database,
                            change: on.field("database"),
                        },
                        { name: "user", label: view.text.user, value: view.values.user, change: on.field("user") },
                        {
                            name: "password",
                            label: view.text.password,
                            value: view.values.password,
                            ...(view.passwordHint === undefined ? {} : { description: view.passwordHint }),
                            change: on.field("password"),
                        },
                    ]}
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
