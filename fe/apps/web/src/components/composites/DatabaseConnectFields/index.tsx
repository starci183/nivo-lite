import { Alert, Input, RadioGroup, Select } from "@starci/grammar/common"
import { databaseConnectFieldsClassNames as classNames } from "./classNames"

/** A text field of the database connect form. */
type DatabaseTextField = "name" | "host" | "port" | "database" | "user" | "password"

/** What the connect step draws: the read-only advice, the target fields and the SSL choice. */
export interface DatabaseConnectFieldsProps {
    readonly props: {
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
            <div className={classNames.fields}>
                <Input
                    id="db-name"
                    name="name"
                    label={view.text.name}
                    hint={view.text.nameHint}
                    isDisabled={view.isDisabled}
                    value={view.values.name}
                    onValueChange={on.field("name")}
                />
                <Select
                    label={view.text.engine}
                    isDisabled={view.isDisabled}
                    value={view.values.engine}
                    options={view.engines}
                    onValueChange={on.engine}
                />
                <Input
                    id="db-host"
                    name="host"
                    label={view.text.host}
                    hint={view.text.hostHint}
                    isDisabled={view.isDisabled}
                    value={view.values.host}
                    onValueChange={on.field("host")}
                />
                <Input
                    id="db-port"
                    name="port"
                    label={view.text.port}
                    isDisabled={view.isDisabled}
                    value={view.values.port}
                    onValueChange={on.field("port")}
                />
                <Input
                    id="db-database"
                    name="database"
                    label={view.text.database}
                    isDisabled={view.isDisabled}
                    value={view.values.database}
                    onValueChange={on.field("database")}
                />
                <Input
                    id="db-user"
                    name="user"
                    label={view.text.user}
                    isDisabled={view.isDisabled}
                    value={view.values.user}
                    onValueChange={on.field("user")}
                />
                {renderDatabaseConnectFieldsPassword(view, on)}
            </div>
            <RadioGroup
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

/** Renders the DatabaseConnectFields password section. */
const renderDatabaseConnectFieldsPassword = (
    view: DatabaseConnectFieldsProps["props"],
    on: DatabaseConnectFieldsProps["on"],
) => (
    <Input
        id="db-password"
        name="password"
        kind="password"
        label={view.text.password}
        isDisabled={view.isDisabled}
        value={view.values.password}
        hint={view.passwordHint}
        onValueChange={on.field("password")}
    />
)
