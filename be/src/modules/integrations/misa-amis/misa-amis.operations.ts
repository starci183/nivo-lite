import type { ProviderOperation } from "@modules/integrations/provider-http"

/** The provider segment of the MISA AMIS level-1 names (`apiSegmentOf` of the provider key). */
const SEGMENT = "nivo.api.misa-amis"

/** What was searched for the official documentation and what was found: every operation below is `docs-missing`. */
const DOCS_MISSING =
    "docs-missing: the AMIS accounting help page `https://helpact.misa.vn/?p=12579` (enable \"K\u1EBFt n\u1ED1i \u1EE9ng d\u1EE5ng\" -> " +
    "API; catalogs and sales vouchers can be pushed) links the developer guide " +
    "`https://developer.misa.vn/products-openapi/AMISKT`, which is a script-rendered portal whose text could not be " +
    "read (2026-11-13: title only, no operation, path, auth or member); no other official source was found, so no " +
    "endpoint, parameter or member is used."

/**
 * Every MISA AMIS operation a generic purpose needs, NAMED and not built (`DOCS_MISSING` says why). Each adapter method refuses
 * `not_available` until the documentation is read; then each entry gets its method, path and documentation URL.
 */
export const MISA_AMIS_OPERATIONS = {
    authToken: {
        api: `${SEGMENT}.auth.token`,
        method: null,
        path: null,
        docs: DOCS_MISSING,
        status: "docs-missing",
        serves: null,
    },
    voucherCreate: {
        api: `${SEGMENT}.voucher.create`,
        method: null,
        path: null,
        docs: DOCS_MISSING,
        status: "docs-missing",
        serves: "nivo.tool.ledger.entry.append",
    },
    partnerFind: {
        api: `${SEGMENT}.partner.find`,
        method: null,
        path: null,
        docs: DOCS_MISSING,
        status: "docs-missing",
        serves: "nivo.tool.accounting.partner.find",
    },
} as const satisfies Readonly<Record<string, ProviderOperation>>
