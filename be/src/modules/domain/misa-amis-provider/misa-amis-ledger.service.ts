import { PROVIDER } from "@nivo-lite/agent-sdk/names"
import { Injectable } from "@nestjs/common"
import type { ConnectionRecord } from "@modules/domain/connections"
import {
    providerRefusal,
    withProof,
    type BusinessLedgerEntry,
    type LedgerPort,
} from "@modules/domain/provider-registry"
import { InjectMisaAmis, MisaAmisError, MisaAmisErrorCode, type MisaAmisClient } from "@modules/integrations/misa-amis"
import { DomainError } from "@modules/platform/errors"

/** The provider key of MISA AMIS accounting, as the connector catalogue lists it. */
export const MISA_AMIS_PROVIDER: typeof PROVIDER.misaAmis = PROVIDER.misaAmis

/** A failure of the AMIS client as the generic port throws it: an operation not built is `not_available`, proving nothing left. */
export const misaAmisFailureOf = (cause: unknown): unknown =>
    cause instanceof MisaAmisError && cause.code === MisaAmisErrorCode.NotAvailable
        ? withProof(providerRefusal(MISA_AMIS_PROVIDER, "not_available", String(cause.params.operation), cause), "not_sent")
        : cause

@Injectable()
/**
 * MISA AMIS accounting as a SECOND owner of the generic ledger purpose (`LedgerPort`: `nivo.tool.ledger.entry.append` / `.void`,
 * beside the Google sheet). Its open API documentation could not be read (`MISA_AMIS_OPERATIONS`), so it is never ready and a write
 * refuses `not_available` and sends nothing. When the documentation is read, an entry becomes one documented voucher.
 */
export class MisaAmisLedgerService implements LedgerPort {
    /** The provider key. */
    readonly provider: string = MISA_AMIS_PROVIDER

    constructor(@InjectMisaAmis() private readonly client: MisaAmisClient) {}

    /** Never ready while no operation is built: the ledger tool never picks it. */
    ready(_account: ConnectionRecord): Promise<boolean> {
        return Promise.resolve(false)
    }

    /** Adds one entry: docs-missing (operation `voucher.create`), refused `not_available`. */
    append(_account: ConnectionRecord, _entry: BusinessLedgerEntry): Promise<string | undefined> {
        return this.voucher()
    }

    /** Takes one entry back: docs-missing (operation `voucher.create`), refused `not_available`. */
    void(_account: ConnectionRecord, _transactionId: string): Promise<string | undefined> {
        return this.voucher()
    }

    private async voucher(): Promise<string | undefined> {
        try {
            return await this.client.createVoucher()
        } catch (cause) {
            const failure = misaAmisFailureOf(cause)
            if (failure instanceof DomainError) throw failure
            throw cause
        }
    }
}
