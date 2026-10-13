import type { StartWebhookRequest, StartWebhookResult } from "../../application/start-webhook.contracts"
import type { StartWebhookBody } from "./dto/start-webhook.request"
import type { StartWebhookResponse } from "./dto/start-webhook.response"
import type { RevealWebhookRequest, RevealWebhookResult } from "../../application/reveal-webhook.contracts"
import type { RevealWebhookResponse } from "./dto/reveal-webhook.response"
import type {
    UpdateWebhookEventsRequest,
    UpdateWebhookEventsResult,
} from "../../application/update-webhook-events.contracts"
import type { UpdateWebhookEventsBody } from "./dto/update-webhook-events.request"
import type { UpdateWebhookEventsResponse } from "./dto/update-webhook-events.response"
import type { TestWebhookRequest, TestWebhookResult } from "../../application/test-webhook.contracts"
import type { TestWebhookResponse } from "./dto/test-webhook.response"
import type { FinishWebhookRequest } from "../../application/finish-webhook.contracts"

/** Maps the HTTP path and body to the StartWebhook request. */
export const toStartWebhookRequest = (workspaceId: string, body: StartWebhookBody): StartWebhookRequest => ({
    workspaceId,
    name: body.name,
    url: body.url,
    events: body.events,
})

/** Maps the StartWebhook result to the HTTP response. */
export const toStartWebhookResponse = (result: StartWebhookResult): StartWebhookResponse => ({
    id: result.id,
    name: result.name,
    host: result.host,
    events: [...result.events],
    signingSecret: result.signingSecret,
})

/** Maps the HTTP path and body to the RevealWebhook request. */
export const toRevealWebhookRequest = (workspaceId: string, connectionId: string): RevealWebhookRequest => ({
    workspaceId,
    connectionId,
})

/** Maps the RevealWebhook result to the HTTP response. */
export const toRevealWebhookResponse = (result: RevealWebhookResult): RevealWebhookResponse => ({
    id: result.id,
    name: result.name,
    host: result.host,
    events: [...result.events],
    signingSecret: result.signingSecret,
})

/** Maps the HTTP path and body to the UpdateWebhookEvents request. */
export const toUpdateWebhookEventsRequest = (
    workspaceId: string,
    connectionId: string,
    body: UpdateWebhookEventsBody,
): UpdateWebhookEventsRequest => ({ workspaceId, connectionId, events: body.events })

/** Maps the UpdateWebhookEvents result to the HTTP response. */
export const toUpdateWebhookEventsResponse = (result: UpdateWebhookEventsResult): UpdateWebhookEventsResponse => ({
    events: [...result],
})

/** Maps the HTTP path and body to the TestWebhook request. */
export const toTestWebhookRequest = (workspaceId: string, connectionId: string): TestWebhookRequest => ({
    workspaceId,
    connectionId,
})

/** Maps the TestWebhook result to the HTTP response. */
export const toTestWebhookResponse = (result: TestWebhookResult): TestWebhookResponse => ({
    ok: result.ok,
    status: result.status,
    error: result.error,
    durationMs: result.durationMs,
})

/** Maps the HTTP path and body to the FinishWebhook request. */
export const toFinishWebhookRequest = (workspaceId: string, connectionId: string): FinishWebhookRequest => ({
    workspaceId,
    connectionId,
})
