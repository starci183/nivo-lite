import { Injectable } from "@nestjs/common"
import { ConnectionSecretReadsService, type ConnectionRecord } from "@modules/domain/connections"
import {
    providerRefusal,
    providerRefusalReason,
    withProof,
    type PaymentLink,
    type PaymentLinkPort,
    type PaymentLinkRef,
    type PaymentLinkRequest,
    type PaymentLinkState,
} from "@modules/domain/provider-registry"
import {
    InjectPayos,
    PAYOS_OPS,
    PayosError,
    PayosErrorCode,
    payosCancelledOf,
    payosCreatedOf,
    payosInfoOf,
    type PayosClient,
    type PayosCredential,
    type PayosData,
    type PayosInfo,
    type PayosOperation,
} from "@modules/integrations/payos"
import { parseJsonText } from "@modules/platform/primitives"
import { OrderCodesPolicy } from "./payos-order-code.policy"
import { DomainError } from "@modules/platform/errors"

/** The provider key. */
const PROVIDER = "payos"

/** The largest value of the documented `expiredAt` (https://payos.vn/docs/api/ : a Unix timestamp "kieu Int32"). */
const INT32_MAX = 2_147_483_647

/** The path members and the body of one payOS call. */
interface PayosCall {
    /** The path parameters. */
    readonly path?: Readonly<Record<string, string>>
    /** The JSON body. */
    readonly body?: PayosData
}

/** Whether a credential member is a non-empty string. */
const present = (value: unknown): value is string => typeof value === "string" && value !== ""

/** The three keys of a payment channel in a connection's credential JSON (`clientId`, `apiKey`, `checksumKey`), or null when one is missing. */
const credentialOf = (credential: string): PayosCredential | null => {
    const read = parseJsonText(credential)
    if (!read.ok) return null
    const parsed = read.value
    if (typeof parsed !== "object" || parsed === null) return null
    const { clientId, apiKey, checksumKey }: Record<string, unknown> = Object.fromEntries(Object.entries(parsed))
    return present(clientId) && present(apiKey) && present(checksumKey) ? { clientId, apiKey, checksumKey } : null
}

/**
 * What a failure of the payOS client proves, attached where it is caught: an answer that refused the request as asked is an ANSWER
 * (`providerRefusal` (a `ProviderRegistryError`), `rejected` / `not_found` / `auth_refused`: no effect, payOS's own words ride along); a 429 refused at the gateway
 * proves `not_sent`; an unreachable API, a 5xx, an unreadable answer or anything else proves nothing (`unknown`: a signed POST that
 * timed out may have created the link).
 */
export const payosFailureOf = (cause: unknown): unknown => {
    if (providerRefusalReason(cause) !== null) return cause
    if (!(cause instanceof PayosError)) return withProof(cause, "unknown")
    const reason = typeof cause.params.reason === "string" ? cause.params.reason : null
    switch (cause.code) {
        case PayosErrorCode.Rejected:
            return providerRefusal(PROVIDER, "rejected", reason, cause)
        case PayosErrorCode.NotFound:
            return providerRefusal(PROVIDER, "not_found", reason, cause)
        case PayosErrorCode.AuthFailed:
            return providerRefusal(PROVIDER, "auth_refused", reason, cause)
        case PayosErrorCode.RateLimited:
            return withProof(cause, "not_sent")
        case PayosErrorCode.Unreachable:
        case PayosErrorCode.Failed:
            return withProof(cause, "unknown")
    }
}

/** The path id of a link: the link id or the order code (the docs: `{id}` is either). */
const idOf = (ref: PaymentLinkRef): string => ("linkId" in ref ? ref.linkId : String(ref.orderCode))

/** A get or cancel answer in the port's words: only the members payOS gave. */
const stateOf = (info: PayosInfo): PaymentLinkState => ({
    linkId: info.id,
    orderCode: info.orderCode,
    amountVnd: info.amount,
    ...(info.amountPaid === null ? {} : { amountPaidVnd: info.amountPaid }),
    ...(info.amountRemaining === null ? {} : { amountRemainingVnd: info.amountRemaining }),
    status: info.status,
    ...(info.createdAt === null ? {} : { createdAt: info.createdAt }),
    ...(info.canceledAt === null ? {} : { canceledAt: info.canceledAt }),
    ...(info.cancellationReason === null ? {} : { cancellationReason: info.cancellationReason }),
})

@Injectable()
/**
 * payOS's adapter of the payment-link purpose, on one connected account: its three keys (`clientId`, `apiKey`, `checksumKey`) are the
 * connection's sealed credential. Every operation and its documentation: `PAYOS_OPS`. The provider's integer order code is generated here
 * (`OrderCodesPolicy`); the adapter is called once per tool call key, so one key creates at most one link.
 */
export class PayosPaymentLinkService implements PaymentLinkPort {
    readonly provider: typeof PROVIDER = PROVIDER

    constructor(
        @InjectPayos() private readonly payos: PayosClient,
        private readonly secrets: ConnectionSecretReadsService,
        private readonly codes: OrderCodesPolicy,
    ) {}

    /** Creates a payment link at payOS. */
    async create(connection: ConnectionRecord, request: PaymentLinkRequest): Promise<PaymentLink> {
        const expiredAt = this.expiredAtOf(request.expiresAt)
        const credential = await this.keysOf(connection)
        const body: PayosData = {
            orderCode: this.codes.next(Date.now()),
            amount: request.amountVnd,
            description: request.description,
            returnUrl: request.returnUrl,
            cancelUrl: request.cancelUrl,
            ...(expiredAt === null ? {} : { expiredAt }),
        }
        const created = await this.run(credential, PAYOS_OPS.createLink, { body }, payosCreatedOf)
        return {
            linkId: created.paymentLinkId,
            orderCode: created.orderCode,
            checkoutUrl: created.checkoutUrl,
            ...(created.qrCode === null ? {} : { qrPayload: created.qrCode }),
            amountVnd: created.amount,
            description: created.description,
            status: created.status,
            ...(request.expiresAt === undefined || expiredAt === null ? {} : { expiresAt: new Date(expiredAt * 1000).toISOString() }),
        }
    }

    /** Reads a payment link at payOS. */
    async get(connection: ConnectionRecord, ref: PaymentLinkRef): Promise<PaymentLinkState> {
        const credential = await this.keysOf(connection)
        return stateOf(await this.run(credential, PAYOS_OPS.getLink, { path: { id: idOf(ref) } }, payosInfoOf))
    }

    /** Cancels a payment link at payOS. */
    async cancel(connection: ConnectionRecord, ref: PaymentLinkRef, reason: string | undefined): Promise<PaymentLinkState> {
        const credential = await this.keysOf(connection)
        const body: PayosData = reason === undefined ? {} : { cancellationReason: reason }
        return stateOf(await this.run(credential, PAYOS_OPS.cancelLink, { path: { id: idOf(ref) }, body }, payosCancelledOf))
    }

    /** The documented `expiredAt`: Unix seconds; an instant that is no Int32 second is refused `rejected` before anything is sent. */
    private expiredAtOf(expiresAt: string | undefined): number | null {
        if (expiresAt === undefined) return null
        const seconds = Math.floor(Date.parse(expiresAt) / 1000)
        if (!Number.isInteger(seconds) || seconds < 1 || seconds > INT32_MAX) throw providerRefusal(PROVIDER, "rejected", "expiresAt")
        return seconds
    }

    /** The account's three keys; none readable (no secret, not JSON, a key missing) is `no_credential`: nothing was sent. */
    private async keysOf(connection: ConnectionRecord): Promise<PayosCredential> {
        const secret = await this.secrets.secretOf(connection.id, PROVIDER)
        const keys = secret.kind === "ok" ? credentialOf(secret.value.credential) : null
        if (keys === null) throw providerRefusal(PROVIDER, "no_credential")
        return keys
    }

    /** Runs one operation and reads its answer; a failure of the call or of the read is typed where it is caught (`payosFailureOf`). */
    private async run<T>(
        credential: PayosCredential,
        operation: PayosOperation,
        call: PayosCall,
        read: (data: PayosData) => T,
    ): Promise<T> {
        try {
            return read(await this.payos.call(credential, operation, call))
        } catch (cause) {
            const failure = payosFailureOf(cause)
            if (failure instanceof DomainError) throw failure
            throw cause
        }
    }
}
