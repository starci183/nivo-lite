import type { FieldWords, ProviderFieldsDeclaration } from "@modules/domain/connection-fields"
import { SMTP_FIELD_WORDS } from "./messages/email-messages.messages"

/** The longest SMTP password taken. */
const PASSWORD_MAX = 200

/** The longest mail address a test goes to. */
const ADDRESS_MAX = 254

/** The action that sends a real test email (`sendTest`). */
export const SMTP_TEST_SEND = "test_send"

/** The action that makes the sender the workspace default (`setDefault`). */
export const SMTP_SET_DEFAULT = "set_default"

/** A fact of the sender, shown and never edited here (changing the server or the address is a new sender). */
const shown = (key: string, label: FieldWords, meta: string): ProviderFieldsDeclaration["fields"][number] => ({
    key,
    label,
    kind: "identity",
    required: false,
    maxLength: null,
    choices: [],
    source: { kind: "meta", key: meta },
})

/**
 * The connection form of an SMTP sender (owner only, as `changeSmtpPassword`): its address, server and user, its password (sealed,
 * write-only), and two actions through the wizard's own service: send a real test email (`sendTest`; success marks it connected
 * and makes it the default when the workspace has none) and make it the default sender (`setDefault`, a connected sender only).
 */
export const SMTP_FIELD_DECLARATIONS: ReadonlyArray<ProviderFieldsDeclaration> = [
    {
        provider: "smtp",
        editableBy: ["owner"],
        canTest: false,
        fields: [
            shown("fromEmail", SMTP_FIELD_WORDS.fromEmail, "from_email"),
            shown("host", SMTP_FIELD_WORDS.host, "host"),
            shown("user", SMTP_FIELD_WORDS.user, "user"),
            {
                key: "password",
                label: SMTP_FIELD_WORDS.password,
                kind: "secret",
                required: false,
                maxLength: PASSWORD_MAX,
                choices: [],
                source: { kind: "none" },
                sealedBy: { kind: "stored-secret" },
                guidance: { text: null, key: "connections.smtpPasswordStored" },
            },
        ],
        actions: [
            {
                key: SMTP_TEST_SEND,
                label: SMTP_FIELD_WORDS.testSend,
                runBy: ["owner"],
                inputs: [
                    {
                        key: "to",
                        label: SMTP_FIELD_WORDS.testTo,
                        kind: "text",
                        required: true,
                        maxLength: ADDRESS_MAX,
                        choices: [],
                        source: { kind: "none" },
                    },
                ],
                results: [
                    { key: "to", label: SMTP_FIELD_WORDS.testTo },
                    { key: "isDefault", label: SMTP_FIELD_WORDS.isDefault },
                ],
                guidance: { text: null, key: "connections.smtpTestOk" },
            },
            { key: SMTP_SET_DEFAULT, label: SMTP_FIELD_WORDS.setDefault, runBy: ["owner"], inputs: [], results: [] },
        ],
    },
]
