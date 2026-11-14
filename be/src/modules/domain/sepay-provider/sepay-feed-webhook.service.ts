import { Injectable, type OnModuleInit } from "@nestjs/common"
import { SepayConnectionService } from "@modules/domain/channel-connections"
import {
    FeedWebhookRegistryService,
    type FeedWebhookPort,
    type FeedWebhookReading,
} from "@modules/domain/provider-registry"
import { isSepayPing, occurredAtOf, presentedApiKey, readSepayPayload, type SepayBody } from "./sepay-webhook.policy"
import type { IntakeRun, OptionalApiKey, OptionalRawBody } from "./sepay-payload.contracts"

@Injectable()
/**
 * What a workspace own SePay feed webhook means: the key SePay presents, and a delivery read as a credit, a debit, something to
 * acknowledge and ignore (the SePay test ping, a transfer that moves no money) or an invalid delivery. Its event id is the one the polled
 * transactions use, so a delivery and a poll of the same transaction are one inbox row.
 */
export class SepayFeedWebhookService implements FeedWebhookPort, OnModuleInit {
    readonly provider = "sepay"
    readonly inboxProvider = "sepay-feed"

    constructor(
        private readonly page: SepayConnectionService,
        private readonly webhooks: FeedWebhookRegistryService,
    ) {}

    /** Hands the webhook to its registry, once, in the app that receives it. */
    onModuleInit(): void {
        this.webhooks.register(this)
    }

    /** The key presented as `Authorization: Apikey <key>`, or undefined. */
    keyOf(authorization: OptionalApiKey): OptionalApiKey {
        return presentedApiKey(authorization)
    }

    /** Remembers the delivery on the SePay connection page, around the intake. */
    traceIntake(connection: string, rawBody: OptionalRawBody, intake: IntakeRun): Promise<void> {
        return this.page.traceIntake(connection, rawBody, intake)
    }

    /** Remembers a delivery whose key was refused. */
    traceRefusal(connection: string): Promise<void> {
        return this.page.traceRefusal(connection)
    }

    /** Reads one delivery body. */
    read(body: SepayBody): FeedWebhookReading {
        if (isSepayPing(body)) return { kind: "ignored" }
        const payload = readSepayPayload(body)
        if (payload === undefined) return { kind: "invalid" }
        const amount = payload.transferAmount
        const occurredAt = occurredAtOf(payload.transactionDate)
        const moves = payload.transferType === "in" || payload.transferType === "out"
        if (!moves || amount === undefined || amount <= 0) return { kind: "ignored" }
        return {
            kind: "transaction",
            credit: {
                amount,
                content: (payload.content ?? payload.description ?? payload.code ?? "").trim(),
                eventId: `sepay:${payload.id}`,
                fallbackBankName: payload.gateway ?? "SePay",
                ...(payload.transferType === "out" ? { direction: "debit" as const } : {}),
                ...(payload.accountNumber === undefined ? {} : { account: payload.accountNumber }),
                ...(occurredAt === undefined ? {} : { occurredAt }),
                ...(payload.referenceCode === undefined ? {} : { bankRef: payload.referenceCode }),
            },
        }
    }
}
