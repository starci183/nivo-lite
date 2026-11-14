import { PROVIDER } from "@nivo-lite/agent-sdk/names"
import { Injectable } from "@nestjs/common"
import type { ConnectionRecord } from "@modules/domain/connections"
import {
    providerRefusal,
    withProof,
    type TemplateMessagePort,
    type TemplateMessageRequest,
    type TemplateMessageSent,
} from "@modules/domain/provider-registry"

/** The provider key of the Zalo Official Account. */
export const ZALO_ZNS_PROVIDER: string = PROVIDER.zaloOa

/** What the refusal says: the official ZNS pages could not be read, so no call is built (see `ZALO_ZNS_OPERATIONS`). */
export const ZALO_ZNS_DOCS_MISSING = "zns documentation"

@Injectable()
/**
 * ZNS (Zalo Notification Service, a template message to a phone number) as a DELIVERY KIND of the Zalo OA behind the one customer send
 * (`TemplateMessagePort`). Its official documentation could not be read (client-rendered pages), so the send is `docs-missing`: it
 * refuses `not_available`, proved `not_sent`, and nothing leaves. When the pages are supplied, only this method and the integration's
 * client change: the port, the registry and the send's delivery kind stay.
 */
export class ZaloZnsTemplateService implements TemplateMessagePort {
    /** The provider key. */
    readonly provider: string = ZALO_ZNS_PROVIDER

    /** Refuses `not_available`: docs-missing. */
    sendTemplate(_connection: ConnectionRecord, _request: TemplateMessageRequest): Promise<TemplateMessageSent> {
        return Promise.reject(withProof(providerRefusal(ZALO_ZNS_PROVIDER, "not_available", ZALO_ZNS_DOCS_MISSING), "not_sent"))
    }
}
