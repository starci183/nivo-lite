"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import { cn } from "@heroui/react"
import { Badge, Button, Input, Text, Textarea } from "@starci/grammar/common"
import { useLocale, useT } from "@/i18n/client"
import { governance } from "@/i18n/dict/governance"
import { office } from "@/i18n/dict/office"
import { assignWorkItem, decideWorkItem, getReconcileDetails, holdWorkItem, type ReconcileCandidate } from "@/lib/flow-actions"
import type { Staff, WorkEdits, WorkItemView } from "@/lib/flow-types"
import {
  APPROVAL_ACTIONS_CLASS_NAME,
  APPROVAL_CARD_CLASS_NAME,
  APPROVAL_FOCUS_CLASS_NAME,
  APPROVAL_QUOTE_CLASS_NAME,
  APPROVAL_STATUS_CLASS_NAME,
  APPROVAL_TEXT_CLASS_NAME,
  AUTHOR_LINE_CLASS_NAME,
  AVATAR_SLOT_CLASS_NAME,
  BUBBLE_COLUMN_CLASS_NAME,
  EXCEPTION_CANDIDATE_CLASS_NAME,
  EXCEPTION_CANDIDATE_ON_CLASS_NAME,
  EXCEPTION_FIELDS_CLASS_NAME,
  INFO_SECTION_CLASS_NAME,
  INFO_TITLE_CLASS_NAME,
  MEMBER_TEXT_CLASS_NAME,
  PENDING_ROW_CLASS_NAME,
  ROW_FIRST_CLASS_NAME,
  ROW_THEIRS_CLASS_NAME,
} from "./classNames"
import { formatStamp, formatTime } from "./format"
import { NivoAvatar } from "./messages"

/** DOM id of the thread card for one work item. */
export const exceptionAnchor = (workItemId: string): string => `exception-${workItemId}`

/** True while the item still needs a person (waiting or failed). */
export const isOpenException = (item: WorkItemView): boolean => item.status === "waiting_decision" || item.status === "failed"

/** Props for {@link ExceptionCard}. */
export type ExceptionCardProps = {
  readonly item: WorkItemView
  readonly staff: ReadonlyArray<Staff>
  readonly ownerName: string
  readonly isFocused: boolean
}

/** Minimum written basis before an unclear bank credit may be marked paid (mirrors the server check in decideWorkItem). */
const BASIS_MIN_CHARS = 10

/** Actions whose approval needs a written basis: a matching amount is not evidence. */
const needsBasis = (item: WorkItemView): boolean => item.action === "reconcile_payment"

/** Candidate invoice row: stacked detail lines (customer, invoice, amount, order). */
const CANDIDATE_DETAIL_CLASS_NAME = cn("flex", "w-full", "flex-col", "items-start", "gap-0.5", "rounded-lg", "border", "border-separator", "px-3", "py-2", "text-left")

const fieldText = (value: string | number | null | undefined): string => (typeof value === "string" ? value : typeof value === "number" ? String(value) : "")

const digits = (value: string): number | null => {
  const only = value.replace(/[^\d]/g, "")
  return only ? Number(only) : null
}

/**
 * A work item NIVO could not finish alone, shown in the thread as a card from NIVO Core: why it
 * stopped, what NIVO proposes, the missing inputs, and the owner's four choices. Once decided it
 * stays as a record with who, when and the result.
 */
export const ExceptionCard = ({ item, staff, ownerName, isFocused }: ExceptionCardProps) => {
  const t = useT(office)
  const g = useT(governance)
  const locale = useLocale()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [busy, setBusy] = useState<"approve" | "reject" | "assign" | "hold" | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isAssigning, setIsAssigning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [draft, setDraft] = useState(item.proposal.draft ?? "")
  const [amount, setAmount] = useState(item.proposal.amount_vnd != null ? String(item.proposal.amount_vnd) : "")
  const [candidateId, setCandidateId] = useState<string | null>(null)
  const [basis, setBasis] = useState("")
  const [isHolding, setIsHolding] = useState(false)
  const [holdNote, setHoldNote] = useState("")
  const [details, setDetails] = useState<{ payment: { amount_vnd: number | null; payer: string | null; reference: string | null }; candidates: ReadonlyArray<ReconcileCandidate> } | null>(null)

  const fieldLabel = (name: string): string => {
    switch (name) {
      case "contact_name": return g("field_contact_name")
      case "need": return g("field_need")
      case "contact": return g("field_contact")
      case "customer": return g("field_customer")
      case "items": return g("field_items")
      case "amount_vnd": return g("field_amount_vnd")
      default: return name
    }
  }
  const isOpen = isOpenException(item)
  const isFailed = item.status === "failed"
  const missing = isFailed ? [] : item.missing_fields
  const candidates = item.proposal.candidates ?? []
  const hasDraft = typeof item.proposal.draft === "string" && item.proposal.draft.length > 0
  const hasAmount = item.proposal.amount_vnd !== undefined && !missing.includes("amount_vnd")
  const isReconcile = needsBasis(item)
  const basisLength = basis.trim().replace(/\s+/g, " ").length
  const isBasisMissing = isReconcile && basisLength < BASIS_MIN_CHARS
  const isOtherIncomplete = missing.some((name) => !(values[name] ?? "").trim()) || (candidates.length > 0 && candidateId === null)
  const isIncomplete = isOtherIncomplete || isBasisMissing
  const money = (n: number | null | undefined): string => (n == null ? "—" : `${new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US").format(n)} ₫`)
  const decidedBasis = fieldText(item.proposal.fields?.basis)
  const heldNote = fieldText(item.proposal.fields?.hold_note)
  const candidateKey = candidates.map((c) => c.id).join(",")

  useEffect(() => {
    if (!isReconcile || !isOpen || !candidateKey) return
    let isLive = true
    getReconcileDetails(item.id)
      .then((result) => {
        if (isLive && result.ok) setDetails(result.data)
      })
      .catch(() => undefined)
    return () => {
      isLive = false
    }
  }, [isReconcile, isOpen, candidateKey, item.id])
  const isBusy = isPending && busy !== null
  const activeStaff = staff.filter((s) => s.active)

  const buildEdits = (): WorkEdits | undefined => {
    const edits: WorkEdits = {}
    const fields: Record<string, string | number | null> = {}
    for (const name of missing) {
      const raw = (values[name] ?? "").trim()
      if (!raw) continue
      if (name === "amount_vnd") {
        edits.amount_vnd = digits(raw)
        fields[name] = digits(raw)
      } else fields[name] = raw
    }
    if (Object.keys(fields).length) edits.fields = fields
    if (candidateId) edits.candidateId = candidateId
    if (isEditing) {
      if (hasDraft && draft.trim() !== item.proposal.draft) edits.draft = draft.trim()
      if (hasAmount) {
        const next = digits(amount)
        if (next !== item.proposal.amount_vnd) edits.amount_vnd = next
      }
    }
    return Object.keys(edits).length ? edits : undefined
  }

  const onDecide = (decision: "approved" | "rejected") => {
    setError(null)
    setBusy(decision === "approved" ? "approve" : "reject")
    startTransition(async () => {
      const approved = decision === "approved"
      const result = await decideWorkItem(item.id, decision, approved ? buildEdits() : undefined, undefined, approved && isReconcile ? basis.trim() : undefined).catch((e: unknown) => ({
        ok: false as const,
        error: e instanceof Error ? e.message : "",
      }))
      if (result.ok) {
        setIsEditing(false)
        router.refresh()
      } else setError(t("exceptionFailed", { error: result.error }))
      setBusy(null)
    })
  }

  const onHold = () => {
    setError(null)
    setBusy("hold")
    startTransition(async () => {
      const result = await holdWorkItem(item.id, holdNote).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "" }))
      if (result.ok) {
        setIsHolding(false)
        setHoldNote("")
        router.refresh()
      } else setError(t("exceptionFailed", { error: result.error }))
      setBusy(null)
    })
  }

  const onAssign = (staffId: string) => {
    setError(null)
    setBusy("assign")
    startTransition(async () => {
      const result = await assignWorkItem(item.id, staffId).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "" }))
      if (result.ok) {
        setIsAssigning(false)
        router.refresh()
      } else setError(t("exceptionFailed", { error: result.error }))
      setBusy(null)
    })
  }

  const statusWord = item.status === "rejected" ? g("status_rejected") : g("status_done")
  const stamp = formatStamp(item.completed_at ?? item.updated_at, locale)
  const assignedLine = item.assignedStaffName ? t("exceptionAssigned", { name: item.assignedStaffName, time: stamp }) : null
  const settled = assignedLine ?? t("exceptionDecided", { status: statusWord, who: ownerName, time: stamp })
  const footer = isOpen ? assignedLine : settled
  const title = `${g(`action_${item.action}`)}${item.lead ? ` · ${item.lead.contact_name}` : ""}`

  return (
    <div id={exceptionAnchor(item.id)} className={`${ROW_THEIRS_CLASS_NAME} ${ROW_FIRST_CLASS_NAME}`} data-testid="exception-card" data-status={item.status}>
      <div className={AVATAR_SLOT_CLASS_NAME}>
        <NivoAvatar />
      </div>
      <div className={BUBBLE_COLUMN_CLASS_NAME}>
        <div className={AUTHOR_LINE_CLASS_NAME}>
          <Text size="sm" weight="semibold">{t("nivoCore")}</Text>
          <Text size="xs" tone="muted">{formatTime(item.created_at, locale)}</Text>
        </div>
        <article className={isFocused ? `${APPROVAL_CARD_CLASS_NAME} ${APPROVAL_FOCUS_CLASS_NAME}` : APPROVAL_CARD_CLASS_NAME} aria-label={title}>
          <div className={APPROVAL_STATUS_CLASS_NAME}>
            {isOpen ? (
              <Badge tone={isFailed ? "danger" : "warning"} isDot>{isReconcile && !isFailed ? t("reconcileWaiting") : item.reason ? g(`reason_${item.reason}`) : isFailed ? g("status_failed") : t("exceptionTitle")}</Badge>
            ) : (
              <Badge tone={item.status === "rejected" ? "danger" : "success"} isDot>{statusWord}</Badge>
            )}
            <Badge tone="neutral">{g(`dept_${item.department}`)}</Badge>
            {isReconcile && isOpen && !isFailed && item.reason ? <Badge tone="neutral">{g(`reason_${item.reason}`)}</Badge> : null}
            {item.origin === "simulated" ? <Badge tone="neutral">{t("simulatedTag")}</Badge> : null}
          </div>
          <div className={APPROVAL_TEXT_CLASS_NAME}>
            <Text weight="semibold">{title}</Text>
            {item.reason && isOpen && !isFailed ? <Text size="sm" tone="muted">{g(`reasonHint_${item.reason}`)}</Text> : null}
          </div>

          {isFailed && item.error ? (
            <div className={APPROVAL_QUOTE_CLASS_NAME}>
              <Text size="xs" tone="muted" weight="medium">{t("exceptionErrorLabel")}</Text>
              <Text as="p" size="sm">{item.error}</Text>
            </div>
          ) : (
            <div className={APPROVAL_QUOTE_CLASS_NAME}>
              <Text size="xs" tone="muted" weight="medium">{t("exceptionProposes")}</Text>
              <Text as="p" size="sm">{item.proposal.summary}</Text>
              {hasDraft && !isEditing ? <Text as="p" size="sm" tone="muted">{item.proposal.draft}</Text> : null}
            </div>
          )}

          {isOpen && isEditing && hasDraft ? <Textarea label={t("exceptionDraft")} rows={4} value={draft} isDisabled={isBusy} onValueChange={setDraft} /> : null}
          {isOpen && isEditing && hasAmount ? (
            <Input id={`${item.id}-amount`} name="amount_vnd" label={t("exceptionAmount")} variant="secondary" value={amount} isDisabled={isBusy} onValueChange={setAmount} />
          ) : null}

          {isOpen && missing.length > 0 ? (
            <div className={EXCEPTION_FIELDS_CLASS_NAME}>
              <Text size="sm" weight="medium">{t("exceptionMissing")}</Text>
              {missing.map((name) => (
                <Input
                  key={name}
                  id={`${item.id}-${name}`}
                  name={name}
                  label={fieldLabel(name)}
                  variant="secondary"
                  value={values[name] ?? ""}
                  isDisabled={isBusy}
                  onValueChange={(next) => setValues((current) => ({ ...current, [name]: next }))}
                />
              ))}
            </div>
          ) : null}

          {isOpen && !isFailed && isReconcile ? (
            <div className={APPROVAL_QUOTE_CLASS_NAME}>
              <Text size="xs" tone="muted" weight="medium">{t("reconcileCredit")}</Text>
              <Text as="p" size="sm">{t("reconcileCreditLine", {
                amount: money(details?.payment.amount_vnd ?? item.proposal.amount_vnd ?? null),
                payer: details?.payment.payer || fieldText(item.proposal.fields?.payer) || t("reconcileUnknown"),
                ref: details?.payment.reference || fieldText(item.proposal.fields?.reference) || t("reconcileUnknown"),
              })}</Text>
              <Text as="p" size="sm" tone="muted">{t("reconcileWarning")}</Text>
            </div>
          ) : null}

          {isOpen && candidates.length > 0 ? (
            <div className={EXCEPTION_FIELDS_CLASS_NAME} role="radiogroup" aria-label={t("exceptionCandidates")}>
              <Text size="sm" weight="medium">{t("exceptionCandidates")}</Text>
              {isReconcile && !details ? <Text size="xs" tone="muted">{t("candidatesLoading")}</Text> : null}
              {candidates.map((c) => {
                const d = details?.candidates.find((x) => x.id === c.id)
                const isOn = candidateId === c.id
                if (isReconcile && d) {
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="radio"
                      aria-checked={isOn}
                      data-testid="reconcile-candidate"
                      className={isOn ? `${CANDIDATE_DETAIL_CLASS_NAME} ${EXCEPTION_CANDIDATE_ON_CLASS_NAME}` : CANDIDATE_DETAIL_CLASS_NAME}
                      onClick={() => setCandidateId(c.id)}
                    >
                      <Text size="sm" weight="semibold">{d.customer ?? t("candidateNoCustomer")}</Text>
                      <Text size="sm">{`${t("candidateInvoice", { no: d.invoice_no })} · ${t("candidateAmount")}: ${money(d.amount_vnd)}`}</Text>
                      <Text size="xs" tone="muted">{d.order_no ? `${t("candidateOrder")}: ${d.order_no}${d.order_items ? ` · ${d.order_items}` : ""}` : t("candidateNoOrder")}</Text>
                      {d.status !== "issued" ? <Text size="xs" tone="muted">{t("candidateNotIssued", { status: d.status })}</Text> : null}
                    </button>
                  )
                }
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={isOn}
                    className={isOn ? `${EXCEPTION_CANDIDATE_CLASS_NAME} ${EXCEPTION_CANDIDATE_ON_CLASS_NAME}` : EXCEPTION_CANDIDATE_CLASS_NAME}
                    onClick={() => setCandidateId(c.id)}
                  >
                    <Text size="sm" weight="medium">{c.label}</Text>
                    {c.label.includes(new Intl.NumberFormat("vi-VN").format(c.amount_vnd)) ? null : (
                      <Text size="sm" tone="muted">{new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US").format(c.amount_vnd)}</Text>
                    )}
                  </button>
                )
              })}
            </div>
          ) : null}

          {isOpen && !isFailed && isReconcile ? (
            <Textarea
              id={`${item.id}-basis`}
              label={t("basisLabel")}
              description={isBasisMissing ? `${t("basisHint", { n: BASIS_MIN_CHARS })} ${t("basisCount", { n: basisLength, min: BASIS_MIN_CHARS })}` : t("basisHint", { n: BASIS_MIN_CHARS })}
              placeholder={t("basisPlaceholder")}
              isRequired
              rows={2}
              value={basis}
              isDisabled={isBusy}
              onValueChange={setBasis}
            />
          ) : null}

          {isOpen && heldNote ? (
            <Text size="xs" tone="muted">{t("heldLine", {
              note: heldNote,
              who: fieldText(item.proposal.fields?.hold_by) || ownerName,
              time: formatStamp(fieldText(item.proposal.fields?.hold_at) || item.updated_at, locale),
            })}</Text>
          ) : null}

          {!isOpen && item.result?.summary ? (
            <div>
              <Text size="xs" tone="muted" weight="medium">{t("exceptionResult")}</Text>
              <Text as="p" size="sm">{item.result.summary}</Text>
              {decidedBasis ? <Text as="p" size="sm" weight="medium">{t("decidedBasis", { basis: decidedBasis })}</Text> : null}
            </div>
          ) : null}
          {footer ? <Text size="xs" tone="muted">{footer}</Text> : null}
          {isOpen && isIncomplete ? <Text size="xs" tone="muted">{isOtherIncomplete ? t("exceptionMissingHint") : t("basisNeeded")}</Text> : null}
          {error ? <Text size="sm" live="assertive">{error}</Text> : null}

          {isOpen && isAssigning ? (
            <div className={EXCEPTION_FIELDS_CLASS_NAME}>
              <Text size="sm" weight="medium">{t("exceptionAssignFirst")}</Text>
              {activeStaff.length === 0 ? (
                <>
                  <Text size="sm" tone="muted">{t("exceptionNoStaff")}</Text>
                  <div><Button variant="outline" href="/authority">{t("exceptionAddStaff")}</Button></div>
                </>
              ) : (
                <div className={APPROVAL_ACTIONS_CLASS_NAME}>
                  {activeStaff.map((s) => (
                    <Button key={s.id} variant="outline" isPending={isPending && busy === "assign"} isDisabled={isBusy} onPress={() => onAssign(s.id)}>
                      {t("exceptionAssignTo", { name: s.name })}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {isOpen && !isFailed && isHolding ? (
            <div className={EXCEPTION_FIELDS_CLASS_NAME}>
              <Textarea id={`${item.id}-hold`} label={t("holdNoteLabel")} placeholder={t("holdNotePlaceholder")} rows={2} value={holdNote} isDisabled={isBusy} onValueChange={setHoldNote} />
              <div className={APPROVAL_ACTIONS_CLASS_NAME}>
                <Button variant="outline" isPending={isPending && busy === "hold"} isDisabled={isBusy || !holdNote.trim()} onPress={onHold}>{t("holdSave")}</Button>
                <Button variant="ghost" isDisabled={isBusy} onPress={() => setIsHolding(false)}>{t("holdCancel")}</Button>
              </div>
            </div>
          ) : null}

          {isOpen ? (
            <div className={APPROVAL_ACTIONS_CLASS_NAME}>
              {isFailed ? null : (
                <Button variant="primary" isPending={isPending && busy === "approve"} isDisabled={isBusy || isIncomplete} onPress={() => onDecide("approved")}>
                  {isEditing ? t("exceptionSaveContinue") : t("exceptionApprove")}
                </Button>
              )}
              {isFailed || !isReconcile || isHolding ? null : (
                <Button variant="outline" isDisabled={isBusy} onPress={() => { setHoldNote((v) => v || basis.trim()); setIsHolding(true) }}>
                  {t("holdAction")}
                </Button>
              )}
              {isFailed || isReconcile || (!hasDraft && !hasAmount) ? null : (
                <Button variant="outline" isDisabled={isBusy} onPress={() => setIsEditing((v) => !v)}>
                  {isEditing ? t("exceptionCancelEdit") : t("exceptionEditContinue")}
                </Button>
              )}
              <Button variant="ghost" isPending={isPending && busy === "reject"} isDisabled={isBusy} onPress={() => onDecide("rejected")}>
                {t("exceptionReject")}
              </Button>
              <Button variant="ghost" isDisabled={isBusy} onPress={() => setIsAssigning((v) => !v)}>
                {t("exceptionAssign")}
              </Button>
            </div>
          ) : null}
          {item.lead ? <div><Button variant="ghost" href={item.href}>{t("exceptionOpenLead")}</Button></div> : null}
        </article>
      </div>
    </div>
  )
}

/** Props for {@link ExceptionList}. */
export type ExceptionListProps = {
  readonly items: ReadonlyArray<WorkItemView>
  readonly onJump: (workItemId: string) => void
}

/** Info-panel "Exceptions" list; each row jumps to its card in the thread. */
export const ExceptionList = ({ items, onJump }: ExceptionListProps) => {
  const t = useT(office)
  const g = useT(governance)
  return (
    <section className={INFO_SECTION_CLASS_NAME} aria-label={t("exceptionsTitle")}>
      <div className={INFO_TITLE_CLASS_NAME}>
        <Text weight="semibold">{t("exceptionsTitle")}</Text>
        <Text size="sm" tone="muted">{`${items.length}`}</Text>
      </div>
      {items.length === 0 ? (
        <Text size="sm" tone="muted">{t("exceptionsNone")}</Text>
      ) : (
        items.map((item) => (
          <button key={item.id} type="button" className={PENDING_ROW_CLASS_NAME} onClick={() => onJump(item.id)} aria-label={`${t("exceptionJump")}: ${g(`action_${item.action}`)}`}>
            <NivoAvatar size="xs" />
            <span className={MEMBER_TEXT_CLASS_NAME}>
              <Text size="sm" weight="medium" overflow="clamp-2">{`${g(`action_${item.action}`)}${item.lead ? ` · ${item.lead.contact_name}` : ""}`}</Text>
              <Text size="xs" tone="muted" overflow="truncate">{item.reason ? g(`reason_${item.reason}`) : g("status_failed")}</Text>
            </span>
          </button>
        ))
      )}
    </section>
  )
}
