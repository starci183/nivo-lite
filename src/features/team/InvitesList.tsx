"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Alert, Badge, Button, SurfaceCard, Text } from "@starci/grammar/common"
import { PersonAvatar } from "@/components/avatar/PersonAvatar"
import { intlLocale, TIME_ZONE } from "@/i18n/core"
import { useLocale, useT } from "@/i18n/client"
import { team } from "@/i18n/dict/team"
import { copyInviteLink, resendInvite, revokeInvite, type InviteResult } from "@/lib/invites"
import type { Outcome } from "@/lib/types"
import type { PendingInvite } from "./queries"
import { ACTIONS_CLASS, FACTS_CLASS, IDENTITY_CLASS, IDENTITY_TEXT_CLASS, LINK_BOX_CLASS, LINK_TEXT_CLASS, ROW_CLASS, STACK_CLASS } from "./classNames"

/** Props for {@link InvitesList}. */
export type InvitesListProps = { readonly invites: ReadonlyArray<PendingInvite> }

const ROLE_KEY = { manager: "roleManager", staff: "roleStaff" } as const

type Shown = { id: string; email: string; link: string; copied: boolean }

/** Pending invitations with expiry, resend, revoke and "copy invite link" (which issues a fresh link). */
export const InvitesList = ({ invites }: InvitesListProps) => {
  const t = useT(team)
  const locale = useLocale()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [shown, setShown] = useState<Shown | null>(null)

  const date = (iso: string) => new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium", timeStyle: "short", timeZone: TIME_ZONE }).format(new Date(iso))

  const copy = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link)
      setShown((s) => (s ? { ...s, copied: true } : s))
    } catch {
      // The link stays visible and selectable; the person can copy it by hand.
    }
  }

  const run = <R,>(id: string, job: () => Promise<Outcome<R>>, after: (data: R) => void) => {
    setError(null)
    setNotice(null)
    setBusy(id)
    startTransition(async () => {
      try {
        const result = await job()
        if (result.ok) {
          after(result.data)
          router.refresh()
        } else setError(result.error)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(null)
      }
    })
  }

  const onResend = (id: string) => run<InviteResult>(id, () => resendInvite(id), (r) => {
    setNotice(t("inviteResent", { email: r.email }))
    setShown({ id, email: r.email, link: r.link, copied: false })
  })
  const onCopy = (id: string) => run<InviteResult>(id, () => copyInviteLink(id), (r) => {
    setShown({ id, email: r.email, link: r.link, copied: false })
    void copy(r.link)
  })
  const onRevoke = (id: string) => run<null>(id, () => revokeInvite(id), () => {
    setNotice(t("inviteRevoked"))
    setShown(null)
  })

  return (
    <SurfaceCard label={t("invitesTitle")} headingLevel={2}>
      <div className={STACK_CLASS}>
        <Text size="sm" tone="muted">{t("invitesDesc")}</Text>
        {error ? <Alert title={t("errGeneric")} description={error} tone="negative" /> : null}
        {notice ? <Text size="sm" live="polite">{notice}</Text> : null}
        {invites.length === 0 ? (
          <Text size="sm">{t("invitesEmpty")}</Text>
        ) : (
          <ul>
            {invites.map((i) => (
              <li key={i.id} className={ROW_CLASS}>
                <div className={IDENTITY_CLASS}>
                  <PersonAvatar name={i.email} size="md" />
                  <div className={IDENTITY_TEXT_CLASS}>
                    <Text weight="semibold" overflow="truncate">{i.email}</Text>
                    <Text size="sm" tone="muted">{i.expired ? t("inviteExpired", { date: date(i.expiresAt) }) : t("inviteExpires", { date: date(i.expiresAt) })}</Text>
                    {i.staffName ? <Text size="xs" tone="muted" overflow="truncate">{t("inviteStaffFor", { name: i.staffName })}</Text> : null}
                  </div>
                </div>
                <div className={FACTS_CLASS}>
                  <Badge tone={i.expired ? "warning" : "accent"}>{t(ROLE_KEY[i.role])}</Badge>
                </div>
                <div className={ACTIONS_CLASS}>
                  <Button variant="outline" isPending={isPending && busy === i.id} onPress={() => onResend(i.id)}>{t("inviteResend")}</Button>
                  <Button variant="outline" isPending={isPending && busy === i.id} onPress={() => onCopy(i.id)}>{t("inviteCopy")}</Button>
                  <Button variant="ghost" isPending={isPending && busy === i.id} onPress={() => onRevoke(i.id)}>{t("inviteRevoke")}</Button>
                </div>
                {shown?.id === i.id ? (
                  <div className={LINK_BOX_CLASS}>
                    <Text size="xs" tone="muted">{t("inviteLinkLabel", { email: shown.email })}</Text>
                    <code className={LINK_TEXT_CLASS}>{shown.link}</code>
                    <Text size="xs" tone="muted" live="polite">{shown.copied ? t("inviteCopied") : t("inviteRotateNote")}</Text>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </SurfaceCard>
  )
}
