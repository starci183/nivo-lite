"use client"

import { connectionPageOf, pollConnectionPage } from "@/hooks/connectionPage"
import { useQueryZaloConnectionPageSwr } from "@/hooks/swr"
import { ZALO_PAGE_POLL_MS } from "./zaloConnection.shared"

import type { DataSlot } from "@/modules/types"
import type { SWRResponse, KeyedMutator } from "swr"

type UseZaloPageResult = {
    read: SWRResponse<
        {
            id: string
            name: string
            status: string
            healthy: boolean
            oaId: string
            appId: string
            appSecretMask: string | null
            oaSecretMask: string | null
            callbackUrl: string
            webhookUrl: string
            sendBlock: string | null
            agentIds: Array<string>
            access: {
                state: string
                expiresAt: string | null
                expiredMinutesAgo: number | null
                canRefresh: boolean
            }
            checks: Array<{
                key: string
                state: string
                code: string
                at: string | null
                names: Array<string>
            }>
            recipients: Array<{
                userId: string
                name: string
                lastMessageAt: string
            }>
            znsRenewal: {
                templateId: string
                params: {
                    customerName: string
                    plan: string
                    endDate: string
                    amount: string
                    transferContent: string
                    invoiceNumber: string
                }
            } | null
        },
        unknown,
        any
    >
    slot: DataSlot<{
        id: string
        name: string
        status: string
        healthy: boolean
        oaId: string
        appId: string
        appSecretMask: string | null
        oaSecretMask: string | null
        callbackUrl: string
        webhookUrl: string
        sendBlock: string | null
        agentIds: Array<string>
        access: {
            state: string
            expiresAt: string | null
            expiredMinutesAgo: number | null
            canRefresh: boolean
        }
        checks: Array<{
            key: string
            state: string
            code: string
            at: string | null
            names: Array<string>
        }>
        recipients: Array<{
            userId: string
            name: string
            lastMessageAt: string
        }>
        znsRenewal: {
            templateId: string
            params: {
                customerName: string
                plan: string
                endDate: string
                amount: string
                transferContent: string
                invoiceNumber: string
            }
        } | null
    }>
    isMissing: boolean
    reload: () => undefined
    mutate: KeyedMutator<{
        id: string
        name: string
        status: string
        healthy: boolean
        oaId: string
        appId: string
        appSecretMask: string | null
        oaSecretMask: string | null
        callbackUrl: string
        webhookUrl: string
        sendBlock: string | null
        agentIds: Array<string>
        access: {
            state: string
            expiresAt: string | null
            expiredMinutesAgo: number | null
            canRefresh: boolean
        }
        checks: Array<{
            key: string
            state: string
            code: string
            at: string | null
            names: Array<string>
        }>
        recipients: Array<{
            userId: string
            name: string
            lastMessageAt: string
        }>
        znsRenewal: {
            templateId: string
            params: {
                customerName: string
                plan: string
                endDate: string
                amount: string
                transferContent: string
                invoiceNumber: string
            }
        } | null
    }>
}

/** The page of one Zalo OA connection, asked again, fast while the connection needs attention and slowly while it is healthy; `isMissing` once the back end says no such connection exists (an id it does not know, or one that is no id). */
export const useZaloPage = (connectionId: string): UseZaloPageResult =>
    connectionPageOf(
        useQueryZaloConnectionPageSwr(connectionId, { refreshInterval: pollConnectionPage(ZALO_PAGE_POLL_MS) }),
    )

/** What one read of the page answers. */
export type ZaloPageData = NonNullable<ReturnType<typeof useZaloPage>["read"]["data"]>
