import type { SandboxCatalogue } from "@modules/domain/provider-sandbox"

/**
 * The key the ZNS catalogue registers under. ZNS answers for the `zalo_oa` account, but the catalogue registry keeps ONE catalogue per
 * key and the Zalo OA's own catalogue (`ZALO-n`) already holds `zalo_oa`, so a second registration there would replace it.
 */
export const ZALO_ZNS_SANDBOX_PROVIDER = "zalo_zns"

/** The approved template the sandbox sends (an order confirmation): the natural key of `ZNS-1`. */
export const ZNS_SANDBOX_SENT_TEMPLATE = "000001"

/** The template id of `ZNS-2`: one the OA never registered. Any template id the catalogue does not name is refused the same way. */
export const ZNS_SANDBOX_UNKNOWN_TEMPLATE = "000404"

/** The template id of `ZNS-3`: an account whose daily template quota is used up. */
export const ZNS_SANDBOX_QUOTA_TEMPLATE = "000429"

/**
 * Zalo ZNS's hardcoded sandbox cases (ruling R60), picked by the template id of the request: a template sent, one refused because the
 * template is unknown, and one refused because the quota is used up. ZNS has no inbound case: its delivery reports are not a
 * sandbox route yet.
 */
export const ZALO_ZNS_SANDBOX_CATALOGUE: SandboxCatalogue = {
    provider: ZALO_ZNS_SANDBOX_PROVIDER,
    cases: [
        {
            id: "ZNS-1",
            label: "Template 000001 (order confirmation) sent to a phone number: accepted, a running message id SBX-ZNS-000001, 000002 ...",
            operation: "sendTemplate",
        },
        {
            id: "ZNS-2",
            label: "Template 000404 is not a template of this OA (or any id the catalogue does not name): refused not_found, nothing sent",
            operation: "sendTemplate",
        },
        {
            id: "ZNS-3",
            label: "Template 000429: the OA's template quota is used up: refused rejected, nothing sent",
            operation: "sendTemplate",
        },
    ],
}
