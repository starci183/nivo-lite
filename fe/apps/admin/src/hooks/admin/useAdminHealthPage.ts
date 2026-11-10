"use client"

import { useQueryAdminHealthSwr } from "@/hooks/swr"
import { adminFailureOf, type AdminFailure } from "./admin.shared"
import { readError } from "@/hooks/workspaceread"

/** The view `useAdminHealthPage` returns. */
export interface AdminHealthPageView {
    health:
        | {
              signups: Array<{
                  day: string
                  signups: number
              }>
              transfers: Array<{
                  status: string
                  transferAmount: number | null
                  content: string | null
                  receivedAt: string
              }>
              transferCounts: Array<{
                  key: string
                  count: number
              }>
              billingEvents: Array<{
                  id: string
                  workspaceId: string | null
                  kind: string
                  createdAt: string
              }>
              errors: Array<{
                  id: string
                  scope: string
                  message: string
                  workspaceId: string | null
                  createdAt: string
              }>
              errorScopes: Array<{
                  key: string
                  count: number
              }>
              audits: Array<{
                  id: string
                  actorEmail: string
                  action: string
                  workspaceId: string | null
                  createdAt: string
              }>
              workspaceNames: Array<{
                  id: string
                  name: string
              }>
          }
        | undefined
    isLoading: boolean
    failure: AdminFailure
    reload: () => undefined
}

/** The platform health page, with its loading state and its failure sorted into a 404 or a message. */
export const useAdminHealthPage = (): AdminHealthPageView => {
    const swrRead = useQueryAdminHealthSwr()
    const { data, isLoading } = swrRead
    const error = readError(swrRead)
    return { health: data, isLoading, failure: adminFailureOf(error), reload: () => void swrRead.mutate() }
}
