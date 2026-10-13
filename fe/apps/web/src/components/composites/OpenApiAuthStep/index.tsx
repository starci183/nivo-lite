import { Input, Select } from "@starci/grammar/common"
import { openApiAuthStepClassNames as classNames } from "./classNames"

/** A text field of the address and sign-in step. */
type OpenApiAuthField = "baseUrl" | "authName" | "authValue" | "authUser" | "authPassword"

/** What the address and sign-in step of the OpenAPI wizard draws and reports. */
type OpenApiAuthStepProps = {
    readonly values: Readonly<Record<OpenApiAuthField | "authType", string>>
    readonly options: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly isDisabled: boolean
    readonly text: {
        readonly baseUrl: string
        /** The validation message, else the hint. */
        readonly baseUrlHint: string
        readonly auth: string
        /** "Header name" or "Parameter name", by the auth type. */
        readonly authName: string
        readonly authNameError: string | undefined
        /** "Token" or "API key", by the auth type. */
        readonly authValue: string
        /** "Leave blank to keep the saved value" when a secret is saved. */
        readonly secretHint: string | undefined
        readonly user: string
        readonly password: string
    }
    readonly onField: (field: OpenApiAuthField, value: string) => void
    readonly onAuthType: (value: string | null) => void
}

/** Step "auth" of the OpenAPI wizard: base URL, auth type and the key, token or user and password. */
export const OpenApiAuthStep = (props: OpenApiAuthStepProps) => {
    const { values, text, isDisabled, onField } = props
    const keyed = values.authType === "header" || values.authType === "query"
    return (
        <div className={classNames.column}>
            <Input
                id="oa-base"
                name="baseUrl"
                label={text.baseUrl}
                variant="secondary"
                hint={text.baseUrlHint}
                isDisabled={isDisabled}
                value={values.baseUrl}
                onValueChange={(value) => onField("baseUrl", value)}
            />
            <Select
                label={text.auth}
                variant="secondary"
                options={props.options}
                value={values.authType}
                onValueChange={props.onAuthType}
            />
            {keyed ? (
                <Input
                    id="oa-auth-name"
                    name="authName"
                    label={text.authName}
                    variant="secondary"
                    hint={text.authNameError}
                    isDisabled={isDisabled}
                    value={values.authName}
                    onValueChange={(value) => onField("authName", value)}
                />
            ) : null}
            {keyed || values.authType === "bearer" ? (
                <Input
                    id="oa-auth-value"
                    name="authValue"
                    label={text.authValue}
                    variant="secondary"
                    kind="password"
                    hint={text.secretHint}
                    isDisabled={isDisabled}
                    value={values.authValue}
                    onValueChange={(value) => onField("authValue", value)}
                />
            ) : null}
            {values.authType === "basic" ? (
                <>
                    <Input
                        id="oa-auth-user"
                        name="authUser"
                        label={text.user}
                        variant="secondary"
                        isDisabled={isDisabled}
                        value={values.authUser}
                        onValueChange={(value) => onField("authUser", value)}
                    />
                    <Input
                        id="oa-auth-pass"
                        name="authPass"
                        label={text.password}
                        variant="secondary"
                        kind="password"
                        hint={text.secretHint}
                        isDisabled={isDisabled}
                        value={values.authPassword}
                        onValueChange={(value) => onField("authPassword", value)}
                    />
                </>
            ) : null}
        </div>
    )
}
