"use client"

import { useEffect, useRef, useState } from "react"
import { Alert, Button, Text, Textarea } from "@starci/grammar/common"
import { useLocale, useT } from "@/i18n/client"
import { automations as dict } from "@/i18n/dict/automations"
import { generateAutomationBody } from "@/lib/automation-actions"
import { fillBody, SAMPLE_VARS, type AutomationCardView, type ShopContext } from "@/lib/automation-shared"
import { ACTIONS_CLASS, BUBBLE_CLASS, CHIPS_CLASS, FACTS_CLASS, SECTION_CLASS, VAR_CHIP_CLASS } from "./classNames"

/** Props for {@link MessageSection}. */
export type MessageSectionProps = {
  readonly card: AutomationCardView
  readonly shop: ShopContext
  readonly busy: boolean
  readonly onSaveBody: (body: string) => Promise<boolean>
  /** Save the body, then switch the automation on. */
  readonly onSaveAndEnable: (body: string) => Promise<boolean>
  readonly onError: (message: string) => void
}

/** The approved wording: a proposal written from the shop's context, editable, always reviewed and saved by the owner, with a live preview. */
export const MessageSection = ({ card, shop, busy, onSaveBody, onSaveAndEnable, onError }: MessageSectionProps) => {
  const t = useT(dict)
  const locale = useLocale()
  const def = card.def
  const fallback = def.defaultBody ? def.defaultBody[locale] : ""
  const [body, setBody] = useState(card.body ?? "")
  const [composing, setComposing] = useState(false)
  const [note, setNote] = useState<"proposal" | "fallback" | null>(null)
  const asked = useRef(false)

  const compose = async () => {
    setComposing(true)
    const r = await generateAutomationBody(card.key)
    setComposing(false)
    if (!r.ok) return onError(r.error)
    setBody(r.data.body)
    setNote(r.data.generated ? "proposal" : "fallback")
  }

  // No approved wording yet: show the proposal straight away so the owner can read it before switching on.
  useEffect(() => {
    if (card.body === null && !asked.current) {
      asked.current = true
      void compose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!def.defaultBody) return null
  const text = body.trim() ? body : fallback
  const preview = fillBody(text, { ten_shop: shop.shop, gio_mo_cua: shop.hours, ...SAMPLE_VARS })
  const unsaved = body.trim().length > 0 && body.trim() !== (card.body ?? "")
  const disabled = busy || composing

  return (
    <section className={SECTION_CLASS} aria-label={t("messageTitle")}>
      <div className={FACTS_CLASS}>
        <Text weight="semibold">{t("messageTitle")}</Text>
        <Text size="sm" tone="muted">{t("messageHelp")}</Text>
      </div>
      {card.bodyStale ? (
        <Alert title={t("staleTitle")} description={t("staleBody")} tone="cautionary" action={{ label: t("regenerate"), onAction: () => void compose() }} />
      ) : null}
      <Textarea id={`${card.key}-body`} name="body" label={t("messageLabel")} rows={5} maxLength={600} value={body} isDisabled={disabled} onValueChange={(v) => { setBody(v); setNote(null) }} />
      {note ? <Text size="xs" tone="muted">{note === "proposal" ? t("proposalNote") : t("fallbackNote")}</Text> : null}
      <div className={FACTS_CLASS}>
        <Text size="xs" tone="muted">{t("variablesTitle")}</Text>
        <div className={CHIPS_CLASS}>{def.variables.map((v) => <span key={v} className={VAR_CHIP_CLASS}>{`{${v}}`}</span>)}</div>
      </div>
      <div className={ACTIONS_CLASS}>
        {card.body === null ? (
          <Button variant="primary" isPending={busy} isDisabled={composing || body.trim().length < 10} onPress={() => void onSaveAndEnable(body)}>{t("enableWithBody")}</Button>
        ) : null}
        <Button variant={card.body === null ? "secondary" : "primary"} isPending={busy} isDisabled={composing || !unsaved || body.trim().length < 10} onPress={() => void onSaveBody(body)}>{t("saveBody")}</Button>
        <Button variant="outline" isPending={composing} isDisabled={busy} onPress={() => void compose()}>{composing ? t("composing") : t("compose")}</Button>
      </div>
      <div className={FACTS_CLASS}>
        <Text size="xs" tone="muted">{t("previewTitle")}</Text>
        <div className={BUBBLE_CLASS}>{preview}</div>
        {shop.tone.trim() ? <Text size="xs" tone="muted">{t("previewTone", { tone: shop.tone })}</Text> : null}
      </div>
    </section>
  )
}
