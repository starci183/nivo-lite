"use client"

import { useTranslations } from "next-intl"
import { useMutateCreateContentItemSwr, useMutateMoveContentItemSwr, useMutateDecideWorkItemSwr } from "@/hooks/swr"
import type { MutateCreateContentItemRequest } from "@/modules/api/graphql/mutations/mutation-create-content-item"
import { useGraphQLWithToast } from "@/modules/toast"

/** The content list's create, reschedule and approval commands, with localized mutation feedback. */
export const useContentItemActions = () => {
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
