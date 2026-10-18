import { Injectable } from "@nestjs/common"
import { HttpErrorCode, InjectHttpClient } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { N8nError, N8nErrorCode } from "./errors/n8n.error"
import type { N8nDelivery, N8nTargetResult } from "./n8n.contracts"
import { InjectN8nHostResolver, InjectN8nOptions } from "./n8n.decorators"
import { N8nLogEvent } from "./n8n.log-events"
import type { N8nOptions } from "./n8n.options"
import { assertAllowedTarget, assertEventName, isTransientStatus, signBody, workspaceKey } from "./n8n.policy"
import type { N8nHostResolver } from "./n8n.policy"

const MAX_TARGETS = 5
const HTTP_OK_FLOOR = 200
const HTTP_OK_CEILING = 300

interface SignedBody {
    readonly event: string
    readonly deliveryId: string
    readonly timestamp: string
    readonly signature: string
    readonly body: string
}

@Injectable()
/**
 * Posts one signed event to the webhook urls of a workspace. The body carries the delivery id (the receiver's dedupe key: a retry
 * resends the same id), the event, the workspace and the data; the headers carry the event, the delivery id, the timestamp and the
 * HMAC of `<timestamp>.<body>` with the workspace key.
 */
export class N8nClient {
    constructor(
        @InjectN8nOptions() private readonly options: N8nOptions,
        @InjectN8nHostResolver() private readonly resolve: N8nHostResolver,
        @InjectHttpClient() private readonly http: HttpClient,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /**
     * Delivers the event to every target. Throws a retryable error when a target failed transiently and a refusal when every target
     * was refused for good; otherwise answers what happened per target.
     */
    async deliver(delivery: N8nDelivery): Promise<ReadonlyArray<N8nTargetResult>> {
        const event = assertEventName(delivery.event)
        const targets = [...delivery.urls, ...this.pathTargets(delivery.paths)].slice(0, MAX_TARGETS)
        if (targets.length === 0) throw new N8nError({ code: N8nErrorCode.NoTarget })
        const body = JSON.stringify({
            id: delivery.deliveryId,
            event,
            workspace_id: delivery.workspaceId,
            occurred_at: new Date(delivery.occurredAtMs).toISOString(),
            data: delivery.data,
        })
        const timestamp = String(delivery.occurredAtMs)
        const key = workspaceKey(this.options.signingSecret.reveal(), delivery.workspaceId)
        const signed: SignedBody = {
            event,
            deliveryId: delivery.deliveryId,
            timestamp,
            signature: signBody(key, timestamp, body),
            body,
        }
        const results: Array<N8nTargetResult> = []
        await eachInOrder(targets, async (target) => {
            results.push(await this.post(target, signed))
        })
        const failed = results.filter((result) => !result.ok)
        if (failed.some((result) => result.transient)) {
            throw new N8nError({ code: N8nErrorCode.DeliveryFailed, params: { targets: failed.length } })
        }
        if (failed.length === results.length) {
            throw new N8nError({ code: N8nErrorCode.TargetRefused, params: { targets: failed.length } })
        }
        return results
    }

    private pathTargets(paths: ReadonlyArray<string>): ReadonlyArray<string> {
        const configured = this.options.webhookBase
        let end = configured?.length ?? 0
        while (end > 0 && configured?.[end - 1] === "/") end -= 1
        const base = configured?.slice(0, end)
        return base === undefined ? [] : paths.map((path) => `${base}/${path.replace(/^\/+/, "")}`)
    }

    private async post(target: string, signed: SignedBody): Promise<N8nTargetResult> {
        try {
            const url = await assertAllowedTarget(target, this.options.allowedHosts, this.resolve)
            const response = await this.http.request({
                method: "POST",
                url: url.href,
                headers: {
                    "content-type": "application/json",
                    "x-nivo-event": signed.event,
                    "x-nivo-delivery": signed.deliveryId,
                    "x-nivo-timestamp": signed.timestamp,
                    "x-nivo-signature": signed.signature,
                },
                bytes: Buffer.from(signed.body),
                timeoutMs: this.options.timeoutMs,
            })
            const ok = response.status >= HTTP_OK_FLOOR && response.status < HTTP_OK_CEILING
            return {
                origin: url.origin,
                ok,
                status: response.status,
                transient: !ok && isTransientStatus(response.status),
            }
        } catch (cause) {
            const origin = URL.canParse(target) ? new URL(target).origin : "invalid"
            if (cause instanceof Error && "code" in cause && cause.code === HttpErrorCode.BodyUnreadable) {
                return { origin, ok: true, status: undefined, transient: false }
            }
            this.logger.warn(N8nLogEvent.TargetFailed, { event: signed.event, origin })
            return { origin, ok: false, status: undefined, transient: !(cause instanceof N8nError) }
        }
    }
}
