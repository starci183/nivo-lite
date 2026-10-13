import { useLocale } from "next-intl"
import { useCallback, useMemo } from "react"
import { decodeInviteResult, decodeNothing, request } from "@/modules/api"
import type { InviteResultItem, Outcome } from "@/modules/api"
import { readBrowserAccessToken } from "@/modules/db/browser"

/** What a person types to invite someone. */
export interface InviteInput {
    readonly email: string
    readonly role: "manager" | "staff"
    /** The staff row the account will be, or null. */
    readonly staffId: string | null
}

/** The calls the invitation blocks make to the back end api. */
export interface InviteCommands {
    readonly create: (input: InviteInput) => Promise<Outcome<InviteResultItem>>
    readonly resend: (inviteId: string) => Promise<Outcome<InviteResultItem>>
    readonly copyLink: (inviteId: string) => Promise<Outcome<InviteResultItem>>
    readonly revoke: (inviteId: string) => Promise<Outcome<null>>
}

const unauthenticated = (code: string): Outcome<never> => ({ kind: "refused", status: 401, fault: { code } })

/** The invitation commands of one workspace, sent with the signed-in person token and the reader language; the back end proves the role. */
export const useInviteCommands = (workspaceId: string): InviteCommands => {
    const locale = useLocale()
    const send = useCallback(
        async <T>(
            path: string,
            method: "POST" | "DELETE",
            body: unknown,
            decode: (text: string) => Outcome<T>,
        ): Promise<Outcome<T>> => {
            const token = await readBrowserAccessToken()
            if (token.kind !== "ok") return unauthenticated(token.code)
            return request({ path, method, token: token.value, locale, workspaceId, body }, decode)
        },
        [locale, workspaceId],
    )
    return useMemo<InviteCommands>(
        () => ({
            create: (input) =>
                send(
                    "/workspaces/invites",
                    "POST",
                    {
                        email: input.email.trim(),
                        role: input.role,
                        ...(input.staffId === null ? {} : { staffId: input.staffId }),
                    },
                    decodeInviteResult,
                ),
            resend: (inviteId) => send(`/workspaces/invites/${inviteId}/resend`, "POST", undefined, decodeInviteResult),
            copyLink: (inviteId) => send(`/workspaces/invites/${inviteId}/link`, "POST", undefined, decodeInviteResult),
            revoke: (inviteId) => send(`/workspaces/invites/${inviteId}`, "DELETE", undefined, decodeNothing),
        }),
        [send],
    )
}
