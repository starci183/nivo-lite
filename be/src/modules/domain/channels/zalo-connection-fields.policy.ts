import type { ProviderFieldsDeclaration } from "@modules/domain/connection-fields"
import { ZALO_FIELD_WORDS } from "./messages/channels.messages"

/** The shortest and longest OA Secret Key the Zalo connect step takes (`saveOaSecret`). */
const OA_SECRET_MIN = 8
const OA_SECRET_MAX = 200

/**
 * The connection form of a Zalo OA (owner only, as `saveZaloOaSecret`): the OA's name and id as Zalo reported them and the app id
 * sealed at connect time (shown, never edited: new app keys are a new connection), the webhook address to paste in the app's Webhook
 * settings (copyable), and the OA Secret Key (sealed, write-only; sealed once the connect step set `oa_secret_saved`). "Check
 * connection" reads the stored tokens. Guidance is the words the old steps showed, by their key in the web catalogue.
 */
export const ZALO_FIELD_DECLARATIONS: ReadonlyArray<ProviderFieldsDeclaration> = [
    {
        provider: "zalo_oa",
        editableBy: ["owner"],
        canTest: true,
        guidance: { text: null, key: "zaloConnection.stepPaste" },
        fields: [
            {
                key: "oaName",
                label: ZALO_FIELD_WORDS.oaName,
                kind: "identity",
                required: false,
                maxLength: null,
                choices: [],
                source: { kind: "meta", key: "oa_name" },
            },
            {
                key: "oaId",
                label: ZALO_FIELD_WORDS.oaId,
                kind: "identity",
                required: false,
                maxLength: null,
                choices: [],
                source: { kind: "meta", key: "oa_id" },
            },
            {
                key: "appId",
                label: ZALO_FIELD_WORDS.appId,
                kind: "identity",
                required: false,
                maxLength: null,
                choices: [],
                source: { kind: "meta", key: "app_id" },
                guidance: { text: null, key: "connectionWizard.zaloAppHint" },
            },
            {
                key: "webhookUrl",
                label: ZALO_FIELD_WORDS.webhookUrl,
                kind: "identity",
                required: false,
                maxLength: null,
                choices: [],
                copyable: true,
                source: { kind: "webhook-url" },
            },
            {
                key: "oaSecret",
                label: ZALO_FIELD_WORDS.oaSecret,
                kind: "secret",
                required: false,
                minLength: OA_SECRET_MIN,
                maxLength: OA_SECRET_MAX,
                choices: [],
                source: { kind: "none" },
                sealedBy: { kind: "meta-flag", key: "oa_secret_saved" },
                guidance: { text: null, key: "zaloConnection.oaSecretMissing" },
            },
        ],
    },
]
