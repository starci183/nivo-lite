import { PROVIDER } from "@nivo-lite/agent-sdk/names"
import type { ProviderFieldsDeclaration } from "@modules/domain/connection-fields"

/** Tino's provider key (the SDK's `PROVIDER.tino`). */
export const TINO_PROVIDER: typeof PROVIDER.tino = PROVIDER.tino

/**
 * Tino's connection form (credential NAMES only, no value): the personal API token (`tinopat_...`, created at
 * https://auth.tino.vn/me/security with the scopes `domains:read`, `domains:write`, `dns:read`, `dns:write`, shown once;
 * https://docs.tino.vn/docs/personal-tokens), sealed and write-only. An order or a renewal Tino pays from the balance needs
 * `billing:write` as well (https://docs.tino.vn/docs/personal-tokens, `orders:write`).
 */
export const TINO_FIELD_DECLARATION: ProviderFieldsDeclaration = {
    provider: TINO_PROVIDER,
    editableBy: ["owner"],
    canTest: false,
    fields: [
        {
            key: "apiToken",
            label: { vi: "Token API c\u00e1 nh\u00e2n c\u1ee7a Tino", en: "Tino personal API token" },
            kind: "secret",
            required: false,
            maxLength: 256,
            choices: [],
            source: { kind: "none" },
            sealedBy: { kind: "stored-secret" },
        },
    ],
}
