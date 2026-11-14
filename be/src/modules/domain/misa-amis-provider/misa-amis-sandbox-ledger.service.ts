import { Injectable } from "@nestjs/common"
import { PROVIDER } from "@nivo-lite/agent-sdk/names"
import type { ConnectionRecord } from "@modules/domain/connections"
import {
    providerCallFailure,
    providerRefusal,
    withProof,
    type BusinessLedgerEntry,
    type LedgerPort,
} from "@modules/domain/provider-registry"
import { ProviderSandboxService } from "@modules/domain/provider-sandbox"
import { AMIS_SANDBOX_CASE, AMIS_SANDBOX_OPERATION, AMIS_SANDBOX_REFUSAL_OPERATION } from "./misa-amis-sandbox.catalogue"

/** State name: the vouchers the account booked, by bank transaction id. */
const VOUCHER = "voucher"

/** A voucher as the account's state keeps it. */
interface KeptVoucher {
    readonly reference: string
    readonly orderNo: string
    readonly amountVnd: number
}

/** The running number of a call: six digits, counted from the calls of the operation the account took before it. */
const numberOf = (seq: number): string => String(seq + 1).padStart(6, "0")

/** The refusal the live twin throws for every voucher: `not_available` naming `voucher.create`, proved not sent. */
const voucherRefusal = (provider: string): unknown =>
    withProof(providerRefusal(provider, "not_available", AMIS_SANDBOX_REFUSAL_OPERATION), "not_sent")

@Injectable()
/**
 * MISA AMIS's SANDBOX ledger (R56 / R62): the SAME `LedgerPort` as its live twin, which takes the ACCOUNT, so the registry's one switch
 * `portFor(account)` reaches it. It answers through the generic sandbox frame from the hardcoded `MISA-AMIS-<n>` catalogue and never
 * reaches a host. The account's sticky NEXT CASE of each operation picks the outcome, never the request: `ready` is true (MISA-AMIS-1,
 * default); `append` books a voucher kept in state by its bank transaction id and answers the running reference `SBX-AMIS-<n>`
 * (MISA-AMIS-2, default, by the appends the account took, `state.seq`), or is refused `not_available` (`voucher.create`, `not_sent`),
 * the very refusal the live twin throws (-3), or gives no answer (`unknown`, nothing kept, -4); `void` answers `SBX-AMIS-VOID-<n>`
 * (-5, default) or is refused `not_available` (-6). The state rule that does not depend on a case: a void names a transaction the
 * account appended, one it never appended is `not_found` (`not_sent`). The sandbox adds no idempotency: a second void adds another
 * entry (the ledger only ever adds). What live AMIS answers for a real voucher is UNKNOWN (its open documentation could not be read).
 */
export class MisaAmisSandboxLedgerService implements LedgerPort {
    /** The provider key. */
    readonly provider: string = PROVIDER.misaAmis

    constructor(private readonly sandbox: ProviderSandboxService) {}

    /** A sandbox account is ready, through exactly one sandbox call. */
    async ready(account: ConnectionRecord): Promise<boolean> {
        return await this.sandbox.call(account, AMIS_SANDBOX_OPERATION.ready, {}, { answer: () => true })
    }

    /** Books one entry as a voucher, by the account's next case of `append`, through exactly one sandbox call keyed by its bank transaction id. */
    async append(account: ConnectionRecord, entry: BusinessLedgerEntry): Promise<string> {
        return await this.sandbox.call(account, AMIS_SANDBOX_OPERATION.append, entry, {
            key: entry.transactionId,
            answer: async (state) => {
                if (state.nextCase === AMIS_SANDBOX_CASE.appendRefused) throw voucherRefusal(this.provider)
                if (state.nextCase === AMIS_SANDBOX_CASE.appendNoAnswer) throw providerCallFailure("unknown")
                const reference = `SBX-AMIS-${numberOf(state.seq)}`
                const kept: KeptVoucher = { reference, orderNo: entry.orderNo, amountVnd: entry.amountVnd }
                await state.write(VOUCHER, entry.transactionId, kept)
                return reference
            },
        })
    }

    /** Takes one entry back, by the account's next case of `void`, through exactly one sandbox call keyed by its bank transaction id. */
    async void(account: ConnectionRecord, transactionId: string): Promise<string> {
        return await this.sandbox.call(account, AMIS_SANDBOX_OPERATION.void, { transactionId }, {
            key: transactionId,
            answer: async (state) => {
                if (state.nextCase === AMIS_SANDBOX_CASE.voidRefused) throw voucherRefusal(this.provider)
                if ((await state.read(VOUCHER, transactionId)) === null) {
                    throw withProof(providerRefusal(this.provider, "not_found", "voucher"), "not_sent")
                }
                return `SBX-AMIS-VOID-${numberOf(state.seq)}`
            },
        })
    }
}
