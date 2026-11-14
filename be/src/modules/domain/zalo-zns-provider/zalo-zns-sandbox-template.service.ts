import { Injectable } from "@nestjs/common"
import type { ConnectionRecord } from "@modules/domain/connections"
import {
    providerRefusal,
    withProof,
    type TemplateMessagePort,
    type TemplateMessageRequest,
    type TemplateMessageSent,
} from "@modules/domain/provider-registry"
import { ProviderSandboxService } from "@modules/domain/provider-sandbox"
import { ZNS_SANDBOX_QUOTA_TEMPLATE, ZNS_SANDBOX_SENT_TEMPLATE } from "./zalo-zns-sandbox.catalogue"
import { ZALO_ZNS_PROVIDER } from "./zalo-zns-template.service"

/** What the quota refusal says as the provider's words. */
export const ZNS_SANDBOX_QUOTA_DETAIL = "template quota exceeded"

/** What the unknown-template refusal says as the provider's words. */
export const ZNS_SANDBOX_UNKNOWN_DETAIL = "template not found"

/** The running message id of the nth accepted send of this operation (`state.seq` counts the calls before it). */
const messageIdOf = (seq: number): string => `SBX-ZNS-${String(seq + 1).padStart(6, "0")}`

@Injectable()
/**
 * The sandbox twin of the ZNS template send, picked by the request's template id from the catalogue (`ZNS-1..`): the sent template
 * answers a running message id, the quota template is refused `rejected`, and every other template id is refused `not_found`; both
 * refusals are the platform's answer about the request, proved `not_sent` (the same typed refusals the live adapter throws). The live
 * send refuses everything `not_available` until its documentation is read, so it has no real error shape for these two; the
 * reasons are the registry's generic refusal words, and the provider's own error numbers are NOT guessed. It never calls Zalo.
 */
export class ZaloZnsSandboxTemplateService implements TemplateMessagePort {
    readonly provider: string = ZALO_ZNS_PROVIDER

    constructor(private readonly sandbox: ProviderSandboxService) {}

    /** Sends the template of the catalogue, or refuses as its case says. */
    sendTemplate(connection: ConnectionRecord, request: TemplateMessageRequest): Promise<TemplateMessageSent> {
        return this.sandbox.call(connection, "sendTemplate", request, {
            key: request.templateId,
            answer: (state) => {
                if (request.templateId === ZNS_SANDBOX_SENT_TEMPLATE) return { messageId: messageIdOf(state.seq) }
                if (request.templateId === ZNS_SANDBOX_QUOTA_TEMPLATE) {
                    throw withProof(providerRefusal(ZALO_ZNS_PROVIDER, "rejected", ZNS_SANDBOX_QUOTA_DETAIL), "not_sent")
                }
                throw withProof(providerRefusal(ZALO_ZNS_PROVIDER, "not_found", ZNS_SANDBOX_UNKNOWN_DETAIL), "not_sent")
            },
        })
    }
}
