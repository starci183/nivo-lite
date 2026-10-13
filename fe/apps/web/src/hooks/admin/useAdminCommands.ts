import { useLocale } from "next-intl"
import { useCallback, useMemo } from "react"
import {
    decodeAdminExtended,
    decodeAdminInviteResent,
    decodeAdminPlanSet,
    decodeAdminStatusSet,
    request,
} from "@/modules/api"
import type { AdminSupportStatus, Outcome } from "@/modules/api"
import { readBrowserAccessToken } from "@/modules/db/browser"
import type { AdminReply } from "./admin.shared"

/** The support actions the console makes on one workspace; each answers what it came to. */
export interface AdminCommands {
    readonly extend: (days: number) => Promise<AdminReply>
    readonly setStatus: (status: AdminSupportStatus) => Promise<AdminReply>
    readonly setPlan: (planCode: string, creditsLimit: number | null) => Promise<AdminReply>
    readonly resendInvite: (inviteId: string) => Promise<AdminReply>
}

const unauthenticated = (code: string): Outcome<never> => ({ kind: "refused", status: 401, fault: { code } })

const replyOf = <T>(outcome: Outcome<T>, isUndelivered: (value: T) => boolean): AdminReply =>
    outcome.kind === "ok"
        ? { kind: "ok", isUndelivered: isUndelivered(outcome.value) }
        : { kind: "failed", message: outcome.fault.message }

/** The support actions of one workspace, sent with the signed-in person token and the reader language; the back end proves the admin. */
export const useAdminCommands = (workspaceId: string): AdminCommands => {
    const locale = useLocale()
    const send = useCallback(
        async <T>(
            path: string,
            body: unknown,
            decode: (text: string) => Outcome<T>,
            isUndelivered: (value: T) => boolean = () => false,
        ): Promise<AdminReply> => {
            const token = await readBrowserAccessToken()
            if (token.kind !== "ok") return replyOf(unauthenticated(token.code), isUndelivered)
            const sent = await request(
                { path: `/admin/workspaces/${workspaceId}${path}`, method: "POST", token: token.value, locale, body },
                decode,
            )
            return replyOf(sent, isUndelivered)
        },
        [locale, workspaceId],
    )
    return useMemo<AdminCommands>(
        () => ({
            extend: (days) => send("/extend", { days }, decodeAdminExtended),
            setStatus: (status) => send("/status", { status }, decodeAdminStatusSet),
            setPlan: (planCode, creditsLimit) => send("/plan", { planCode, creditsLimit }, decodeAdminPlanSet),
            resendInvite: (inviteId) =>
                send(
                    `/invites/${inviteId}/resend`,
                    undefined,
                    decodeAdminInviteResent,
                    (sent) => sent.delivery === "none",
                ),
        }),
        [send],
    )
}
