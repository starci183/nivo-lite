"use client"

import { useQueryAdminWorkspaceSwr } from "@/hooks/swr"
import { adminFailureOf, type AdminFailure } from "./admin.shared"
import { readError } from "@/hooks/workspaceread"
import type { SWRResponse } from "swr"

/** The read-only facts of one workspace as the admin overview shows them. */
export interface AdminWorkspaceDetailData {
    knowledgeTotal: number
    workspace: {
        id: string
        name: string
        ownerEmail: string | null
        status: string
        planCode: string | null
        paidUntil: string | null
        createdAt: string
    }
    credits: {
        used: number
        limit: number | null
        costUsd: number
        ownLimit: number | null
    }
    members: Array<{
        userId: string
        role: string
        displayName: string
        status: string
        email: string | null
    }>
    invites: Array<{
        id: string
        email: string
        role: string
        createdAt: string
        expiresAt: string
    }>
    orders: Array<{
        id: string
        orderCode: string
        planCode: string
        amountVnd: number
        status: string
        createdAt: string
        paidAt: string | null
    }>
    transfers: Array<{
        sepayId: number
        transferAmount: number | null
        content: string | null
        status: string
        receivedAt: string
    }>
    billingEvents: Array<{
        id: string
        kind: string
        createdAt: string
    }>
    modules: Array<{
        id: string
        key: string
        status: string
        operatingMode: string
        live: boolean
        contextVersion: number | null
        contextAppliedAt: string | null
    }>
    connections: Array<{
        id: string
        provider: string
        name: string
        status: string
        environment: string
        lastEventAt: string | null
        lastError: string | null
        health: string
    }>
    errors: Array<{
        id: string
        scope: string
        message: string
        createdAt: string
    }>
    knowledge: Array<{
        kind: string
        byStatus: Array<{
            key: string
            count: number
        }>
    }>
    activity: {
        messages7d: number
        lastCustomerMessageAt: string | null
        openDecisions: number
    }
}

/** The view `useAdminWorkspaceDetail` returns. */
export interface AdminWorkspaceDetailView {
    read: SWRResponse<AdminWorkspaceDetailData, Error>
    detail: AdminWorkspaceDetailData | undefined
    isLoading: boolean
    failure: AdminFailure
    reload: () => undefined
}

/** The read-only overview of one workspace, with its loading state and its failure sorted into a 404 or a message. */
export const useAdminWorkspaceDetail = (workspaceId: string): AdminWorkspaceDetailView => {
    const swrRead = useQueryAdminWorkspaceSwr({ workspaceId })
    const { data, isLoading } = swrRead
    const error = readError(swrRead)
    return {
        read: swrRead,
        detail: data,
        isLoading,
        failure: adminFailureOf(error),
        reload: () => void swrRead.mutate(),
    }
}
