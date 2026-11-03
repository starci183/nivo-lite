"use client"

import { useMutateCreateContentItemSwr, useMutateDecideWorkItemSwr, useMutateMoveContentItemSwr } from "@/hooks/swr"
import type { MutateCreateContentItemRequest } from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import { useTranslations } from "next-intl"

/** The view `useContentItemActions` returns. */
export interface ContentItemActionsView {
    create: (input: MutateCreateContentItemRequest) => Promise<
        | {
              kind: "handled"
              value?: never
          }
        | {
              kind: "ok"
              value: {
                  approvedAt: string | null
                  approvedBy: string | null
                  brief: string
                  channels: Array<string>
                  createdAt: string
                  createdBy: string
                  draftedAt: string | null
                  hashtags: Array<string>
                  holidayKey: string | null
                  id: string
                  pillarId: string | null
                  planId: string | null
                  publishedAt: string | null
                  scheduledAt: string | null
                  source: string
                  status: string
                  title: string
                  updatedAt: string
                  workItemId: string | null
                  workspaceId: string
                  evidence: Array<{
                      at: string
                      by: string
                      kind: string
                      text: string
                  }>
                  links: Array<{
                      label: string
                      url: string
                  }>
                  media: Array<{
                      id: string | null
                      kind: string
                      name: string
                      path: string | null
                      suggested: boolean
                  }>
                  published: Array<{
                      at: string
                      by: string
                      channel: string
                      how: string
                      url: string
                  }>
                  variants: Array<{
                      channel: string
                      hashtags: Array<string>
                      note: string
                      text: string
                  }>
              }
          }
    >
    move: (
        id: string,
        scheduledAt: string,
    ) => Promise<{
        kind: string
    }>
    decide: (
        workItemId: string,
        decision: "approved" | "rejected",
    ) => Promise<{
        kind: string
    }>
}

/** The content list's create, reschedule and approval commands, with localized mutation feedback. */
export const useContentItemActions = (): ContentItemActionsView => {
    const t = useTranslations("content")
    const runGraphQL = useGraphQLWithToast()
    const createMutation = useMutateCreateContentItemSwr()
    const moveMutation = useMutateMoveContentItemSwr()
    const decideMutation = useMutateDecideWorkItemSwr()
    return {
        create: async (input: MutateCreateContentItemRequest) => {
            const value = await runGraphQL(() => createMutation.trigger(input), { successMessage: t("saved") })
            return value === undefined ? { kind: "handled" as const } : { kind: "ok" as const, value }
        },
        move: async (id: string, scheduledAt: string) => {
            const value = await runGraphQL(() => moveMutation.trigger({ id, scheduledAt }), {
                successMessage: t("saved"),
            })
            return { kind: value === undefined ? "handled" : "ok" }
        },
        decide: async (workItemId: string, decision: "approved" | "rejected") => {
            const value = await runGraphQL(() => decideMutation.trigger({ workItemId, decision }), {
                successMessage: t(decision === "approved" ? "queueApproved" : "queueRejected"),
            })
            return { kind: value === undefined ? "handled" : "ok" }
        },
    }
}
