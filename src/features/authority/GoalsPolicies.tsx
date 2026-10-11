"use client"

import { useState } from "react"
import { NumberField, SurfaceCard, Text, Textarea } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { authority as dict } from "@/i18n/dict/authority"
import { saveAuthority } from "@/lib/flow-actions"
import type { Authority } from "@/lib/flow-types"
import { FIELDS_CLASS, GOALS_GRID_CLASS } from "./classNames"
import { fromField, toField } from "./model"
import { SaveRow, useSaver } from "./SaveRow"

/** Props shared by the two sections that edit the authority row. */
export type AuthoritySectionProps = {
  /** The stored authority; null while it loads. */
  readonly authority: Authority | null
  /** STATE-8: labels stay, the unresolved values and the save action are skeletons. */
  readonly isLoading?: boolean
}

/** Section 1: revenue, new customers and first-reply goals. */
export const GoalsSection = ({ authority, isLoading = false }: AuthoritySectionProps) => {
  const t = useT(dict)
  const saver = useSaver()
  const [revenue, setRevenue] = useState<number | null>(authority?.goal_revenue_vnd ?? null)
  const [customers, setCustomers] = useState<number | null>(authority?.goal_new_customers ?? null)
  const [reply, setReply] = useState<number | null>(authority?.goal_first_reply_minutes ?? null)
  const [note, setNote] = useState(authority?.goal_note ?? "")

  const onSave = () =>
    saver.run(() => saveAuthority({ goal_revenue_vnd: revenue, goal_new_customers: customers, goal_first_reply_minutes: reply, goal_note: note.trim() }))

  return (
    <SurfaceCard label={t("goalsTitle")} headingLevel={2}>
      <div className={FIELDS_CLASS}>
        <Text size="sm" tone="muted">{t("goalsDesc")}</Text>
        <div className={GOALS_GRID_CLASS}>
          <NumberField variant="secondary" isDisabled={isLoading} label={t("goalRevenue")} description={t("goalRevenueHint")} minValue={0} step={1_000_000} formatOptions={{ maximumFractionDigits: 0 }} value={toField(revenue)} onValueChange={(v) => { saver.reset(); setRevenue(fromField(v)) }} />
          <NumberField variant="secondary" isDisabled={isLoading} label={t("goalCustomers")} minValue={0} step={1} formatOptions={{ maximumFractionDigits: 0 }} value={toField(customers)} onValueChange={(v) => { saver.reset(); setCustomers(fromField(v)) }} />
          <NumberField variant="secondary" isDisabled={isLoading} label={t("goalReply")} minValue={1} step={1} formatOptions={{ maximumFractionDigits: 0 }} value={toField(reply)} onValueChange={(v) => { saver.reset(); setReply(fromField(v)) }} />
        </div>
        <Textarea variant="secondary" isDisabled={isLoading} label={t("goalNote")} description={t("goalNoteHint")} rows={2} value={note} onValueChange={(v) => { saver.reset(); setNote(v) }} />
        <SaveRow saver={saver} onSave={onSave} isLoading={isLoading} />
      </div>
    </SurfaceCard>
  )
}

/** Section 2: business rules, reply style and brand voice. */
export const PoliciesSection = ({ authority, isLoading = false }: AuthoritySectionProps) => {
  const t = useT(dict)
  const saver = useSaver()
  const [policies, setPolicies] = useState(authority?.policies ?? "")
  const [replyStyle, setReplyStyle] = useState(authority?.reply_style ?? "")
  const [brandVoice, setBrandVoice] = useState(authority?.brand_voice ?? "")

  const onSave = () => saver.run(() => saveAuthority({ policies: policies.trim(), reply_style: replyStyle.trim(), brand_voice: brandVoice.trim() }))

  return (
    <SurfaceCard label={t("policiesTitle")} headingLevel={2}>
      <div className={FIELDS_CLASS}>
        <Text size="sm" tone="muted">{t("policiesDesc")}</Text>
        <Textarea variant="secondary" isDisabled={isLoading} label={t("policies")} description={t("policiesHint")} rows={4} value={policies} onValueChange={(v) => { saver.reset(); setPolicies(v) }} />
        <Textarea variant="secondary" isDisabled={isLoading} label={t("replyStyle")} description={t("replyStyleHint")} rows={2} value={replyStyle} onValueChange={(v) => { saver.reset(); setReplyStyle(v) }} />
        <Textarea variant="secondary" isDisabled={isLoading} label={t("brandVoice")} description={t("brandVoiceHint")} rows={2} value={brandVoice} onValueChange={(v) => { saver.reset(); setBrandVoice(v) }} />
        <SaveRow saver={saver} onSave={onSave} isLoading={isLoading} />
      </div>
    </SurfaceCard>
  )
}
