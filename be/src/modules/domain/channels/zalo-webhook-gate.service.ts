import { Injectable } from "@nestjs/common"
import { ZaloCredentialsService } from "./zalo-credentials.service"

@Injectable()
/**
 * Whether a connection can prove its Zalo events. Zalo shows the OA secret key only after the webhook address is saved, and saves it only
 * when the address answers its check with 200: until the connection holds that key, a call to its webhook is acknowledged and dropped.
 */
export class ZaloWebhookGateService {
    constructor(private readonly credentials: ZaloCredentialsService) {}

    /** True when the connection exists and holds the OA secret key its events are proven with. */
    async holdsProofKey(connectionId: string): Promise<boolean> {
        const loaded = await this.credentials.load(connectionId)
        return loaded.kind === "ok"
    }
}
