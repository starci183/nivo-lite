import { Button, Form, Input, SurfaceCard, Text } from "@starci/grammar/common"
import { ACTIONS_CLASS_NAME, FIELDS_CLASS_NAME, FORM_CLASS_NAME } from "./classNames"

/** A text field of the register form. */
type RegisterField = "key" | "name" | "url" | "contractVersion" | "credential"

/** The register form: its values, whether it is sending and its words. */
interface RegisterFormView {
    readonly values: Readonly<Record<RegisterField, string>>
    readonly isPending: boolean
    readonly text: Readonly<
        Record<
            | "title"
            | "hint"
            | "key"
            | "keyHint"
            | "name"
            | "url"
            | "urlHint"
            | "contractVersion"
            | "credential"
            | "credentialHint"
            | "submit",
            string
        >
    >
}

/** The credential form of one connector: its value, whether it is sending and its words. */
interface CredentialFormView {
    readonly value: string
    readonly isPending: boolean
    readonly text: Readonly<Record<"title" | "hint" | "label" | "submit" | "cancel", string>>
}

/** What the connector forms draw and what they report. */
interface McpConnectorFormsProps {
    readonly props: {
        readonly register: RegisterFormView
        /** The open credential form, or null when none is open. */
        readonly credential: CredentialFormView | null
    }
    readonly on: {
        readonly registerField: (field: RegisterField) => (value: string) => void
        readonly register: () => void
        readonly credentialChange: (value: string) => void
        readonly credentialSubmit: () => void
        readonly credentialClose: () => void
    }
}

/** The props of the credential card. */
interface CredentialCardProps {
    readonly view: CredentialFormView
    readonly on: McpConnectorFormsProps["on"]
}

/** The set / rotate credential card: one password field, entered once; the value is never shown back. */
const CredentialCard = (props: CredentialCardProps) => (
    <SurfaceCard label={props.view.text.title} headingLevel={3}>
        <Form label={props.view.text.title} onSubmit={props.on.credentialSubmit} isPending={props.view.isPending}>
            <div className={FORM_CLASS_NAME}>
                <Text size="sm" tone="muted">
                    {props.view.text.hint}
                </Text>
                <Input
                    id="mcp-credential-rotate"
                    name="credential"
                    kind="password"
                    label={props.view.text.label}
                    isRequired
                    isDisabled={props.view.isPending}
                    value={props.view.value}
                    onValueChange={props.on.credentialChange}
                />
                <div className={ACTIONS_CLASS_NAME}>
                    <Button type="submit" intent="commit" isPending={props.view.isPending}>
                        {props.view.text.submit}
                    </Button>
                    <Button intent="alternative" isDisabled={props.view.isPending} onPress={props.on.credentialClose}>
                        {props.view.text.cancel}
                    </Button>
                </div>
            </div>
        </Form>
    </SurfaceCard>
)

/**
 * Registers a remote MCP connector (key, name, endpoint, contract and its credential, entered once and never shown back) and sets
 * or rotates the credential of one. A registered connector stays unapproved until an owner or manager approves its tool list.
 */
export const McpConnectorForms = (props: McpConnectorFormsProps) => {
    const view = props.props.register
    return (
        <>
            {props.props.credential === null ? null : <CredentialCard view={props.props.credential} on={props.on} />}
            <SurfaceCard label={view.text.title} headingLevel={3}>
                <Form label={view.text.title} onSubmit={props.on.register} isPending={view.isPending}>
                    <div className={FORM_CLASS_NAME}>
                        <Text size="sm" tone="muted">
                            {view.text.hint}
                        </Text>
                        <div className={FIELDS_CLASS_NAME}>
                            <Input
                                id="mcp-register-key"
                                name="key"
                                label={view.text.key}
                                description={view.text.keyHint}
                                isRequired
                                isDisabled={view.isPending}
                                value={view.values.key}
                                onValueChange={props.on.registerField("key")}
                            />
                            <Input
                                id="mcp-register-name"
                                name="name"
                                label={view.text.name}
                                isRequired
                                isDisabled={view.isPending}
                                value={view.values.name}
                                onValueChange={props.on.registerField("name")}
                            />
                            <Input
                                id="mcp-register-url"
                                name="url"
                                label={view.text.url}
                                description={view.text.urlHint}
                                isRequired
                                isDisabled={view.isPending}
                                value={view.values.url}
                                onValueChange={props.on.registerField("url")}
                            />
                            <Input
                                id="mcp-register-contract"
                                name="contractVersion"
                                label={view.text.contractVersion}
                                isRequired
                                isDisabled={view.isPending}
                                value={view.values.contractVersion}
                                onValueChange={props.on.registerField("contractVersion")}
                            />
                            <Input
                                id="mcp-register-credential"
                                name="credential"
                                kind="password"
                                label={view.text.credential}
                                description={view.text.credentialHint}
                                isDisabled={view.isPending}
                                value={view.values.credential}
                                onValueChange={props.on.registerField("credential")}
                            />
                        </div>
                        <div className={ACTIONS_CLASS_NAME}>
                            <Button type="submit" intent="commit" isPending={view.isPending}>
                                {view.text.submit}
                            </Button>
                        </div>
                    </div>
                </Form>
            </SurfaceCard>
        </>
    )
}
