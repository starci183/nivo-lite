import { PROVIDER } from "@nivo-lite/agent-sdk/names"
import type { ProviderFieldsDeclaration } from "@modules/domain/connection-fields"

/** iNET's provider key (the SDK's `PROVIDER.inet`). */
export const INET_PROVIDER: typeof PROVIDER.inet = PROVIDER.inet

/** The public facts of an iNET account (connection meta), by name. */
export const INET_META = {
    /** The key context the key was created in (https://developers.inet.vn/docs/getting-started/reseller-connect): `portal` | `reseller`. */
    apiContext: "api_context",
    /** The reseller customer that manages the domains (`customerId` of registration and transfer; created by POST /reseller/customers). */
    customerId: "customer_id",
} as const

/**
 * iNET's connection form (credential NAMES only, no value): the API key (`inet_sk_...`, created at developers.inet.vn, shown once;
 * https://developers.inet.vn/docs/getting-started/authentication), sealed and write-only; the context the key was made in (a reseller
 * key reaches `/reseller/*`, a personal key the Portal API); the reseller customer id the reseller registrations are made for.
 */
export const INET_FIELD_DECLARATION: ProviderFieldsDeclaration = {
    provider: INET_PROVIDER,
    editableBy: ["owner"],
    canTest: false,
    fields: [
        {
            key: "apiKey",
            label: { vi: "Kho\u00e1 API c\u1ee7a iNET", en: "iNET API key" },
            kind: "secret",
            required: false,
            maxLength: 256,
            choices: [],
            source: { kind: "none" },
            sealedBy: { kind: "stored-secret" },
        },
        {
            key: "apiContext",
            label: { vi: "Lo\u1ea1i kho\u00e1", en: "Key context" },
            kind: "choice",
            required: true,
            maxLength: null,
            choices: [
                { value: "portal", label: { vi: "Kh\u00e1ch h\u00e0ng (Portal)", en: "Customer (Portal)" } },
                { value: "reseller", label: { vi: "\u0110\u1ea1i l\u00fd (Reseller)", en: "Reseller" } },
            ],
            source: { kind: "meta", key: INET_META.apiContext },
        },
        {
            key: "customerId",
            label: { vi: "M\u00e3 kh\u00e1ch h\u00e0ng \u0111\u1ea1i l\u00fd", en: "Reseller customer id" },
            kind: "text",
            required: false,
            maxLength: 20,
            choices: [],
            source: { kind: "meta", key: INET_META.customerId },
        },
    ],
}
