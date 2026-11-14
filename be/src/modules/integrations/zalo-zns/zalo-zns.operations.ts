import type { ProviderOperation } from "@modules/integrations/provider-http"

/** The provider segment of the Zalo ZNS level-1 names (the `zalo_oa` provider's own segment, ZNS group). */
const SEGMENT = "nivo.api.zalo-oa.zns"

/**
 * The searched-for state of the official ZNS documentation: `https://developers.zalo.me/docs/zalo-notification-service/...` is a
 * client-rendered application, so every fetch (the ZNS overview, the send page, the changelog V251209, three community posts) returned
 * only the page title and no method, path, member or error table. Third-party SDK guides and community posts name a send call
 * (`phone`, `template_id`, `template_data`, `tracking_id`, `mode`) but are NOT official documentation, and NIVO builds from official
 * documentation only. Facts that were readable and official-adjacent (a community support reply on developers.zalo.me and the
 * changelog title): from 2026-01-01 Zalo merged ZNS and UID messages into "ZBS Template Message"; sending by phone number continues
 * unchanged. The ZNS policy page (https://zns.oa.zalo.me/policy) states delivery only between 07:00 and 22:00 each day (OTP excepted).
 * Until a person pastes the official pages, every operation below is `docs-missing`: no method, no path, no request is built, and the
 * adapter refuses `not_available`.
 */
const SEARCHED = "docs-missing: https://developers.zalo.me/docs/zalo-notification-service (client-rendered, only the title was readable)"

/** The Zalo ZNS operations, by their stable names. */
export interface ZaloZnsOperations {
    /** Sends a template message. */
    readonly messageTemplateSend: ProviderOperation
    /** Lists the templates. */
    readonly templateList: ProviderOperation
    /** Reads one template. */
    readonly templateDetail: ProviderOperation
    /** Reads the quota. */
    readonly quotaGet: ProviderOperation
}

export const ZALO_ZNS_OPERATIONS: ZaloZnsOperations = {
    messageTemplateSend: {
        api: `${SEGMENT}.message.template.send`,
        method: null,
        path: null,
        docs: SEARCHED,
        status: "docs-missing",
        serves: null,
    },
    templateList: {
        api: `${SEGMENT}.template.list`,
        method: null,
        path: null,
        docs: SEARCHED,
        status: "docs-missing",
        serves: null,
    },
    templateDetail: {
        api: `${SEGMENT}.template.detail`,
        method: null,
        path: null,
        docs: SEARCHED,
        status: "docs-missing",
        serves: null,
    },
    quotaGet: {
        api: `${SEGMENT}.quota.get`,
        method: null,
        path: null,
        docs: SEARCHED,
        status: "docs-missing",
        serves: null,
    },
}
