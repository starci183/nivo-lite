import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import type { AttemptEvent, BreakerEvent, KeyDisabledEvent, RequestEvent } from "@starci/ai-router"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectAiGatewayRouter } from "./ai-gateway.decorators"
import type { OptionalAiRouter } from "./ai-gateway.decorators"
import { AiGatewayLogEvent } from "./ai-gateway.log-events"

@Injectable()
/** Sends the router fallback, breaker, rate-limit and key events to the house logger, by alias only. */
export class AiGatewaySubscription implements OnModuleInit {
    constructor(
        @InjectAiGatewayRouter() private readonly router: OptionalAiRouter,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Subscribes to the router events; nothing to watch when no router is registered. */
    onModuleInit(): void {
        if (this.router === null) return
        this.router.on("attempt", (event) => this.attempted(event))
        this.router.on("request", (event) => this.settled(event))
        this.router.on("breaker", (event) => this.breaker(event))
        this.router.on("key-disabled", (event) => this.keyDisabled(event))
    }

    private attempted(event: AttemptEvent): void {
        if (event.outcome === "success") return
        const fields = {
            provider: event.provider,
            key: event.key,
            model: event.model,
            errorClass: event.errorClass ?? null,
            status: event.status ?? null,
            attempt: event.attempt,
            latencyMs: event.latencyMs,
        }
        this.logger.warn(
            event.errorClass === "rate_limit" ? AiGatewayLogEvent.RateLimited : AiGatewayLogEvent.AttemptFailed,
            fields,
        )
    }

    private settled(event: RequestEvent): void {
        if (event.outcome !== "success" || event.attempts <= 1) return
        this.logger.info(AiGatewayLogEvent.FellBack, {
            operation: event.operation,
            attempts: event.attempts,
            provider: event.provider ?? null,
            key: event.key ?? null,
            model: event.model ?? null,
        })
    }

    private breaker(event: BreakerEvent): void {
        this.logger.warn(AiGatewayLogEvent.BreakerChanged, {
            scope: event.scope,
            provider: event.provider,
            key: event.key ?? null,
            from: event.from,
            to: event.to,
        })
    }

    private keyDisabled(event: KeyDisabledEvent): void {
        this.logger.warn(AiGatewayLogEvent.KeyDisabled, {
            provider: event.provider,
            key: event.key,
            reason: event.reason,
            until: event.until,
        })
    }
}
