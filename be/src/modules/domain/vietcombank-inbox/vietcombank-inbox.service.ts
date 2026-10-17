import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectInbox } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import type {
    SimulatedReceiptPayload,
    PendingVietcombankInboxReceipt,
    VietcombankInboxReceiptLookup,
} from "./vietcombank-inbox.contracts"
import {
    INSERT_VIETCOMBANK_INBOX,
    FIND_PENDING_VIETCOMBANK_INBOX,
    COMPLETE_VIETCOMBANK_INBOX,
} from "./persistence/vietcombank-inbox.sql"

@Injectable()
/** Owns durable receipts while participating in the caller's atomic booking transaction. */
export class VietcombankReceiptService {
    constructor(@InjectInbox() private readonly inbox: Inbox) {}

    /** Claims a delivery once using the caller's transaction. */
    claim(manager: EntityManager, deliveryId: string, payload: SimulatedReceiptPayload): Promise<boolean> {
        return this.inbox.claim("vietcombank", deliveryId, manager, { insert: INSERT_VIETCOMBANK_INBOX, payload })
    }

    /** Locks a pending receipt until its booking and completion commit together. */
    async lock(manager: EntityManager, deliveryId: string): Promise<VietcombankInboxReceiptLookup> {
        const [pending] = await manager.query<Array<PendingVietcombankInboxReceipt>>(FIND_PENDING_VIETCOMBANK_INBOX, [
            deliveryId,
        ])
        return pending
    }

    /** Completes the locked receipt in the caller's transaction. */
    async complete(manager: EntityManager, id: string): Promise<void> {
        await manager.query(COMPLETE_VIETCOMBANK_INBOX, [id])
    }
}
