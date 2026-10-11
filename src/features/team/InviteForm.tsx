"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Alert, Button, Form, Input, Select, SurfaceCard, Text } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { team } from "@/i18n/dict/team"
import { createInvite, type InviteResult } from "@/lib/invites"
import type { StaffChoice } from "./queries"
import { FOOTER_CLASS, FORM_GRID_CLASS, LINK_BOX_CLASS, STACK_CLASS } from "./classNames"

/** Props for {@link InviteForm}. */
export type InviteFormProps = {
  readonly staffChoices: ReadonlyArray<StaffChoice>
  /** STATE-8: the choices are loading - the labels stay, the inputs and the action are skeletons. */
  readonly isLoading?: boolean
}

const NO_STAFF = "none"

/** Invite by email: role, optionally "this person is" an existing staff row. Shows the copyable link after sending. */
export const InviteForm = ({ staffChoices, isLoading = false }: InviteFormProps) => {
  const t = useT(team)
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<"manager" | "staff">("staff")
  const [staffId, setStaffId] = useState(NO_STAFF)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<InviteResult | null>(null)
  const [copied, setCopied] = useState(false)

  const submit = () => {
    setError(null)
    setSent(null)
    setCopied(false)
    startTransition(async () => {
      try {
        const result = await createInvite({ email, role, staffId: staffId === NO_STAFF ? null : staffId })
        if (result.ok) {
          setSent(result.data)
          setEmail("")
          setStaffId(NO_STAFF)
          router.refresh()
        } else setError(result.error)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })
  }

  const staffOptions = [
    { id: NO_STAFF, label: t("staffNone") },
    ...staffChoices.map((s) => ({ id: s.id, label: s.role ? t("staffOption", { name: s.name, role: s.role }) : s.name })),
  ]
  const sentText = !sent
    ? null
    : sent.delivery === "invited"
      ? t("sentEmail", { email: sent.email })
      : sent.delivery === "existing"
        ? t("sentNoticeExisting", { email: sent.email })
        : t("sentNoEmail", { email: sent.email })

  return (
    <div data-guide="team.invite">
    <SurfaceCard label={t("formTitle")} headingLevel={2}>
      <Form label={t("formTitle")} onSubmit={submit} isPending={isPending}>
        <div className={STACK_CLASS}>
          <Text size="sm" tone="muted">{t("formDesc")}</Text>
          <div className={FORM_GRID_CLASS}>
            <Input id="invite-email" name="email" kind="email" label={t("fieldEmail")} variant="secondary" isRequired isDisabled={isPending} isSkeleton={isLoading} value={email} onValueChange={setEmail} />
            <Select label={t("fieldRole")} name="role" options={[{ id: "staff", label: t("roleStaff") }, { id: "manager", label: t("roleManager") }]} value={role} isDisabled={isPending || isLoading} onValueChange={(v) => { if (v === "manager" || v === "staff") setRole(v) }} />
            <Select label={t("fieldStaff")} name="staff" options={staffOptions} value={staffId} isDisabled={isPending || isLoading} onValueChange={(v) => setStaffId(v ?? NO_STAFF)} />
          </div>
          <Text size="xs" tone="muted">{t("staffHint")}</Text>
          {error ? <Alert title={t("errGeneric")} description={error} tone="negative" /> : null}
          {sent ? (
            <div className={LINK_BOX_CLASS}>
              <Text size="sm" live="polite">{sentText}</Text>
              <Input
                id="invite-sent-link"
                name="inviteLink"
                label={t("sentLink")}
                variant="secondary"
                value={sent.link}
                isReadOnly
                isCopyable
                copyLabel={t("inviteCopy")}
                copiedLabel={t("inviteCopied")}
                onCopy={() => setCopied(true)}
              />
              {copied ? <Text size="xs" tone="muted" live="polite">{t("inviteCopied")}</Text> : null}
            </div>
          ) : null}
          <div className={FOOTER_CLASS}>
            <Button variant="primary" type="submit" isPending={isPending} isSkeleton={isLoading}>{t("submit")}</Button>
          </div>
        </div>
      </Form>
    </SurfaceCard>
    </div>
  )
}
