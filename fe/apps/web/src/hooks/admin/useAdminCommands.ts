"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { mutate } from "swr"
import { useMutateAdminExtendSubscriptionSwr } from "@/hooks/swr/api/graphql/mutations/useMutateAdminExtendSubscriptionSwr"
import { useMutateAdminResendWorkspaceInviteSwr } from "@/hooks/swr/api/graphql/mutations/useMutateAdminResendWorkspaceInviteSwr"
import { useMutateAdminSetWorkspacePlanSwr } from "@/hooks/swr/api/graphql/mutations/useMutateAdminSetWorkspacePlanSwr"
import { useMutateAdminSetWorkspaceStatusSwr } from "@/hooks/swr/api/graphql/mutations/useMutateAdminSetWorkspaceStatusSwr"
import { QUERY_ADMIN_HEALTH_SWR_KEY } from "@/hooks/swr/api/graphql/queries/useQueryAdminHealthSwr"
import { QUERY_ADMIN_WORKSPACE_SWR_KEY } from "@/hooks/swr/api/graphql/queries/useQueryAdminWorkspaceSwr"
import { QUERY_ADMIN_WORKSPACES_SWR_KEY } from "@/hooks/swr/api/graphql/queries/useQueryAdminWorkspacesSwr"
import { toast, useGraphQLWithToast } from "@/modules/toast"
import type { AdminSupportStatus } from "./admin.shared"

/** The support actions the console makes on one workspace; each answers whether it went through (the failure was toasted). */
export interface AdminCommands {
    readonly extend: (days: number) => Promise<boolean>
    readonly setStatus: (status: AdminSupportStatus) => Promise<boolean>
    readonly setPlan: (planCode: string, creditsLimit: number | null) => Promise<boolean>
    readonly resendInvite: (inviteId: string, email: string) => Promise<boolean>
    /** True while any of the actions is running. */
    readonly isPending: boolean
}

/** Drops the cached console reads a support action may have changed. */
const refreshConsole = () =>
    mutate(
        (key) =>
            Array.isArray(key) &&
            (key[0] === QUERY_ADMIN_WORKSPACE_SWR_KEY ||
                key[0] === QUERY_ADMIN_WORKSPACES_SWR_KEY ||
                key[0] === QUERY_ADMIN_HEALTH_SWR_KEY),
    )

/** The support actions of one workspace through the back end GraphQL API, toasting every outcome; the back end proves the platform admin. */
export const useAdminCommands = (workspaceId: string): AdminCommands => {
    const t = useTranslations("admin")
    const tToast = useTranslations("toast")
    const runGraphQL = useGraphQLWithToast()
    const extendMutation = useMutateAdminExtendSubscriptionSwr()
    const statusMutation = useMutateAdminSetWorkspaceStatusSwr()
    const planMutation = useMutateAdminSetWorkspacePlanSwr()
    const resendMutation = useMutateAdminResendWorkspaceInviteSwr()

    const extend = useCallback(
        async (days: number) => {
            const done = await runGraphQL(() => extendMutation.trigger({ workspaceId, days }), {
                successMessage: t("doneExtend", { days }),
            })
            if (done !== undefined) await refreshConsole()
            return done !== undefined
        },
        [runGraphQL, extendMutation, workspaceId, t],
    )
    const setStatus = useCallback(
        async (status: AdminSupportStatus) => {
            const done = await runGraphQL(() => statusMutation.trigger({ workspaceId, status }), {
                successMessage: t("doneStatus", { status }),
            })
            if (done !== undefined) await refreshConsole()
            return done !== undefined
        },
        [runGraphQL, statusMutation, workspaceId, t],
    )
    const setPlan = useCallback(
        async (planCode: string, creditsLimit: number | null) => {
            const done = await runGraphQL(() => planMutation.trigger({ workspaceId, planCode, creditsLimit }), {
                successMessage:
                    creditsLimit === null
                        ? t("donePlan", { plan: planCode })
                        : t("donePlanOwn", { plan: planCode, credits: creditsLimit }),
            })
            if (done !== undefined) await refreshConsole()
            return done !== undefined
        },
        [runGraphQL, planMutation, workspaceId, t],
    )
    const resendInvite = useCallback(
        async (inviteId: string, email: string) => {
            const sent = await runGraphQL(() => resendMutation.trigger({ workspaceId, inviteId }), {
                showSuccessToast: false,
            })
            if (sent === undefined) return false
            toast.success(tToast("successTitle"), {
                description: t(sent.delivery === "none" ? "doneResendNone" : "doneResend", { email }),
            })
            await refreshConsole()
            return true
        },
        [runGraphQL, resendMutation, workspaceId, t, tToast],
    )
    return {
        extend,
        setStatus,
        setPlan,
        resendInvite,
        isPending:
            extendMutation.isMutating ||
            statusMutation.isMutating ||
            planMutation.isMutating ||
            resendMutation.isMutating,
    }
}
