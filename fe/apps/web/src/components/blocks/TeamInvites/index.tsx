"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { ROLE_KEYS, outcomeErrorKey, useInviteCommands } from "@/hooks/team"
import type { InviteCall, InviteSentView, TeamInviteView } from "@/hooks/team"
import { navigation } from "@/modules/i18n"
import { TeamInvitesBase } from "./component"

/** Props for the connected invitations list. */
interface TeamInvitesProps {
    readonly workspaceId: string
    readonly invites: ReadonlyArray<TeamInviteView>
    /** True while the page loads: the heading stays and the list is skeleton rows. */
    readonly isLoading?: boolean
}

/** The link just issued for one invitation. */
interface Shown {
    readonly id: string
    readonly email: string
    readonly link: string
    readonly isCopied: boolean
}

/** The connected invitations list: resend, copy a fresh link (which replaces the old one) and revoke, through the back end api. */
export const TeamInvites = (props: TeamInvitesProps) => {
    const t = useTranslations("team")
    const format = useFormatter()
    const router = navigation.useRouter()
    const commands = useInviteCommands(props.workspaceId)
    const [isPending, startTransition] = useTransition()
    const [busyId, setBusyId] = useState<string>()
    const [error, setError] = useState<string>()
    const [notice, setNotice] = useState<string>()
    const [shown, setShown] = useState<Shown>()

    const when = (iso: string): string => format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" })

    const run = <R,>(id: string, job: () => Promise<InviteCall<R>>, after: (value: R) => void) => {
        setError(undefined)
        setNotice(undefined)
        setBusyId(id)
        startTransition(async () => {
            const result = await job()
            setBusyId(undefined)
            if (result.kind !== "ok") return setError(t(outcomeErrorKey(result)))
            after(result.value)
            router.refresh()
        })
    }

    const copy = async (link: string): Promise<void> => {
        try {
            await navigator.clipboard.writeText(link)
            setShown((current) => (current === undefined ? current : { ...current, isCopied: true }))
        } catch {
            setError(t("errGeneric"))
        }
    }

    const resend = (id: string) =>
        run(
            id,
            () => commands.resend(id),
            (result: InviteSentView) => {
                setNotice(t("inviteResent", { email: result.email }))
                setShown({ id, email: result.email, link: result.link, isCopied: false })
            },
        )
    const copyLink = (id: string) =>
        run(
            id,
            () => commands.copyLink(id),
            (result: InviteSentView) => {
                setShown({ id, email: result.email, link: result.link, isCopied: false })
                void copy(result.link)
            },
        )
    const revoke = (id: string) =>
        run(
            id,
            () => commands.revoke(id),
            () => {
                setNotice(t("inviteRevoked"))
                setShown(undefined)
            },
        )

    return (
        <TeamInvitesBase
            props={{
                title: t("invitesTitle"),
                description: t("invitesDesc"),
                emptyLabel: t("invitesEmpty"),
                failTitle: t("errGeneric"),
                resendLabel: t("inviteResend"),
                copyLabel: t("inviteCopy"),
                copiedLabel: t("inviteCopied"),
                revokeLabel: t("inviteRevoke"),
                rotateNote: t("inviteRotateNote"),
                rows: ((props.isLoading ?? false) ? [] : props.invites).map((invite) => ({
                    id: invite.id,
                    email: invite.email,
                    expiry: t(invite.isExpired ? "inviteExpired" : "inviteExpires", { date: when(invite.expiresAt) }),
                    staffNote: invite.staffName === null ? undefined : t("inviteStaffFor", { name: invite.staffName }),
                    roleLabel: t(ROLE_KEYS[invite.role]),
                    isExpired: invite.isExpired,
                    isBusy: isPending && busyId === invite.id,
                    link:
                        shown?.id === invite.id
                            ? {
                                  label: t("inviteLinkLabel", { email: shown.email }),
                                  value: shown.link,
                                  isCopied: shown.isCopied,
                              }
                            : undefined,
                })),
                isSkeleton: props.isLoading ?? false,
                error,
                notice,
            }}
            on={{
                resend,
                copyLink,
                revoke,
                linkCopied: () =>
                    setShown((current) => (current === undefined ? current : { ...current, isCopied: true })),
            }}
        />
    )
}
