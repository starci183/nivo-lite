"use client"

import { useQueryAdminWorkspacesSwr } from "@/hooks/swr"
import { adminFailureOf, type AdminFailure, type AdminWorkspaceFilter } from "./admin.shared"
import { readError } from "@/hooks/workspaceread"

/** The view `useAdminWorkspaceList` returns. */
export interface AdminWorkspaceListView {
    list:
        | {
              total: number
              counts: {
                  all: number
                  attention: number
                  unpaid: number
                  idle: number
              }
              items: Array<{
                  id: string
                  name: string
                  ownerEmail: string | null
                  status: string
                  planCode: string | null
                  paidUntil: string | null
                  createdAt: string
                  members: number
                  connectionWarning: boolean
                  lastCustomerMessageAt: string | null
                  messages7d: number
                  openDecisions: number
                  errors24h: number
                  attention: boolean
                  unpaid: boolean
                  idle7d: boolean
                  modules: Array<{
                      key: string
                      status: string
                      live: boolean
                  }>
                  connections: Array<{
                      provider: string
                      count: number
                      error: number
                      silent: number
                  }>
              }>
          }
        | undefined
    isLoading: boolean
    failure: AdminFailure
    reload: () => undefined
}

/** The workspace list for a filter and a search, with its loading state and its failure sorted into a 404 or a message. */
export const useAdminWorkspaceList = (filter: AdminWorkspaceFilter, query: string): AdminWorkspaceListView => {
    const swrRead = useQueryAdminWorkspacesSwr({ filter, query })
    const { data, isLoading } = swrRead
    const error = readError(swrRead)
    return { list: data, isLoading, failure: adminFailureOf(error), reload: () => void swrRead.mutate() }
}
