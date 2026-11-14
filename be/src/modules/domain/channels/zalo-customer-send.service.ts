import { Injectable } from "@nestjs/common"
import type { ConnectionRecord } from "@modules/domain/connections"
import { InjectZalo, type ZaloClient } from "@modules/integrations/zalo"
import type { ChannelTarget, DeliveryResult, PersonMessage } from "./channels.contracts"
import type { CustomerSendPort, CustomerSendRequest } from "./customer-send-ports.contracts"
import { ZaloCredentialsService } from "./zalo-credentials.service"
import { ZaloDeliveryService } from "./zalo-delivery.service"

@Injectable()
/**
 * The LIVE Zalo customer send: the existing Zalo route (the 48-hour window, ZNS fallback, QR image, token refresh) handed through the
 * port unchanged, with the person's name read from Zalo with the OA's token and the staff text sent through the OA. It adds nothing and
 * decides nothing; the registry reaches it only for a live account.
 */
export class ZaloCustomerSendService implements CustomerSendPort {
    readonly provider = "zalo_oa"

    constructor(
        private readonly delivery: ZaloDeliveryService,
        private readonly credentials: ZaloCredentialsService,
        @InjectZalo() private readonly zalo: ZaloClient,
    ) {}

    /** Sends through the Zalo route exactly as it always did. */
    send(
        _account: ConnectionRecord,
        target: ChannelTarget,
        userId: string | null,
        request: CustomerSendRequest,
    ): Promise<DeliveryResult> {
        return this.delivery.send(target, userId, request)
    }

    /** Sends one consultation text to a Zalo user through the OA (a rejected token is refreshed once); throws when it did not go out. */
    sendToPerson(_account: ConnectionRecord, request: PersonMessage): Promise<void> {
        return this.delivery.sendText(request.connectionId, request.recipientId, request.text)
    }

    /** The display name Zalo gives the customer, read with the OA's access token. */
    async nameOf(account: ConnectionRecord, personId: string): Promise<string> {
        const token = await this.credentials.accessToken(account.id)
        return this.zalo.userDisplayName(token, personId)
    }
}
