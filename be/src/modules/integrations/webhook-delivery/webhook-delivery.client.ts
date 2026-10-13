import { lookup } from "node:dns/promises"
import { isIP } from "node:net"
import { Injectable } from "@nestjs/common"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { HttpError, HttpErrorCode, InjectHttpClient } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { WebhookDeliveryError, WebhookDeliveryErrorCode } from "./errors/webhook-delivery.error"
import { InjectWebhookDeliveryOptions } from "./webhook-delivery.decorators"
import type { WebhookPost, WebhookPostResult } from "./webhook-delivery.contracts"
import type { WebhookDeliveryOptions } from "./webhook-delivery.options"
import { isPrivateAddress, refusalOfText } from "./webhook-target.policy"

@Injectable()
/**
 * Delivers signed events to tenant-supplied addresses. The address is tenant input, so it never becomes a way into our own
 * network: http(s) only, no credentials, and on a public site the host must resolve to public addresses; redirects are not followed.
 */
export class WebhookDeliveryClient {
    constructor(
        @InjectWebhookDeliveryOptions() private readonly options: WebhookDeliveryOptions,
        @InjectClock() private readonly clock: Clock,
        @InjectHttpClient() private readonly http: HttpClient,
    ) {}

    /** The usable target, or a TargetRefused error naming why; `requirePublic` is true when the site itself is public. */
    async resolveTarget(raw: string, requirePublic: boolean): Promise<URL> {
        const parsed = refusalOfText(raw)
        if ("reason" in parsed) throw this.refused(parsed.reason)
        if (!requirePublic) return parsed.url
        const host = parsed.url.hostname.replace(/^\[|\]$/gu, "")
        const addresses = isIP(host)
            ? [host]
            : (
                  await lookup(host, { all: true }).catch((cause: unknown) => {
                      throw new WebhookDeliveryError({
                          code: WebhookDeliveryErrorCode.TargetRefused,
                          params: { reason: "host_not_found" },
                          cause,
                      })
                  })
              ).map((entry) => entry.address)
        if (addresses.length === 0) throw this.refused("host_not_found")
        if (addresses.some(isPrivateAddress)) throw this.refused("private")
        return parsed.url
    }

    /** Posts the signed body once and reports what the receiver answered, or that none did. Never throws. */
    async post(delivery: WebhookPost): Promise<WebhookPostResult> {
        const started = this.clock.now().getTime()
        const response = await this.http
            .request({
                method: "POST",
                url: delivery.url.href,
                redirect: "manual",
                timeoutMs: this.options.timeoutMs,
                headers: { "content-type": "application/json", ...delivery.headers },
                bytes: Buffer.from(delivery.body),
                read: "text",
            })
            .catch((cause: unknown) => ({ cause }))
        const durationMs = this.clock.now().getTime() - started
        if ("status" in response) return { status: response.status, failure: null, durationMs }
        const timedOut = response.cause instanceof HttpError && response.cause.code === HttpErrorCode.Timeout
        return { status: null, failure: timedOut ? "timeout" : "unreachable", durationMs }
    }

    private refused(reason: string): WebhookDeliveryError {
        return new WebhookDeliveryError({ code: WebhookDeliveryErrorCode.TargetRefused, params: { reason } })
    }
}
