"use client"

import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryWebhookEvents } from "@/modules/api/graphql/queries/query-webhook-events"
import { answeredData, type ReadResponse } from "@/hooks/workspaceread"
import type { WebhookEventsQuery } from "@/modules/api"

/** The SWR key of the webhookEvents query. */
export const QUERY_WEBHOOK_EVENTS_SWR_KEY = "QUERY_WEBHOOK_EVENTS_SWR"

/** The outgoing events a webhook receiver may pick, each with its name in both languages. */
export const useQueryWebhookEventsSwr = (): ReadResponse<WebhookEventsQuery["webhookEvents"]> =>
    useSWR(
        useWorkspaceKey(QUERY_WEBHOOK_EVENTS_SWR_KEY, []),
        async ({ signal }: { signal?: AbortSignal } = {}) =>
            answeredData(await queryWebhookEvents({ signal }), "webhookEvents").webhookEvents,
    )
