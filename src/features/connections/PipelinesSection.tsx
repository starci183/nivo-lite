"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Alert, Badge, Button, Input, SurfaceCard, Text, Textarea } from "@starci/grammar/common"
import { useLocale, useT } from "@/i18n/client"
import { email } from "@/i18n/dict/email"
import { runPipelineNow, savePipeline } from "@/lib/n8n-actions"
import { N8N_TEMPLATES, defaultConfig, type N8nTemplate } from "@/lib/n8n-templates"
import { ACTIONS_CLASS, FORM_GRID_CLASS, ROW_CLASS, ROW_MAIN_CLASS, STACK_CLASS } from "./classNames"

/** One stored pipeline of the workspace (n8n_pipelines). */
export type PipelineRow = { readonly key: string; readonly enabled: boolean; readonly config: Readonly<Record<string, string | number>> }
export type EmailLogRow = { readonly id: string; readonly to: string; readonly subject: string; readonly purpose: string; readonly status: string; readonly error: string | null; readonly at: string }
export type PipelinesSectionProps = { readonly rows: ReadonlyArray<PipelineRow>; readonly log: ReadonlyArray<EmailLogRow> }

const STATUS_KEY: Record<string, "statusSent" | "statusFailed" | "statusNoSmtp" | "statusBlocked" | "statusRateLimited" | "statusWaiting"> = {
  sent: "statusSent", failed: "statusFailed", no_smtp: "statusNoSmtp", blocked: "statusBlocked", rate_limited: "statusRateLimited", waiting_decision: "statusWaiting",
}

type Note = { tone: "affirmative" | "negative"; text: string }

const PipelineRowView = ({ tpl, row }: { readonly tpl: N8nTemplate; readonly row: PipelineRow | undefined }) => {
  const t = useT(email)
  const locale = useLocale()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState<Record<string, string | number>>({ ...defaultConfig(tpl), ...(row?.config ?? {}) })
  const [note, setNote] = useState<Note | null>(null)
  const [isPending, startTransition] = useTransition()
  const enabled = row?.enabled ?? false

  const save = (nextEnabled: boolean) => startTransition(async () => {
    setNote(null)
    const r = await savePipeline(tpl.key, { enabled: nextEnabled, values })
    if (!r.ok) return setNote({ tone: "negative", text: r.error })
    setNote({ tone: "affirmative", text: t("pipeSaved") })
    router.refresh()
  })
  const runNow = () => startTransition(async () => {
    setNote(null)
    const r = await runPipelineNow(tpl.key)
    setNote(r.ok ? { tone: "affirmative", text: t("pipeStarted") } : { tone: "negative", text: r.error })
    if (r.ok) router.refresh()
  })

  return (
    <div className={ROW_CLASS}>
      <div className={ROW_MAIN_CLASS}>
        <Text weight="semibold">{tpl.name[locale]}</Text>
        <Text size="sm" tone="muted">{tpl.description[locale]}</Text>
        <Text size="xs" tone="muted">{tpl.trigger.line[locale]}</Text>
        <div className={ACTIONS_CLASS}><Badge isDot tone={enabled ? "success" : "neutral"}>{enabled ? t("pipeOn") : t("pipeOff")}</Badge></div>
      </div>
      <div className={ACTIONS_CLASS}>
        <Button variant="secondary" isDisabled={isPending} onPress={() => setOpen((o) => !o)}>{t("pipeSave")}</Button>
        <Button variant={enabled ? "outline" : "primary"} isPending={isPending} onPress={() => save(!enabled)}>{enabled ? t("pipeDisable") : t("pipeEnable")}</Button>
        {tpl.trigger.kind === "schedule" && enabled ? <Button variant="outline" isDisabled={isPending} onPress={runNow}>{t("pipeRunNow")}</Button> : null}
      </div>
      {open ? (
        <div className="w-full">
          <div className={FORM_GRID_CLASS}>
            {tpl.settings.map((s) => s.kind === "textarea" ? (
              <Textarea key={s.key} label={s.label[locale]} description={tpl.variables.map((v) => `{${v}}`).join(" ")} rows={6} value={String(values[s.key] ?? "")} onValueChange={(v) => setValues((p) => ({ ...p, [s.key]: v }))} />
            ) : (
              <Input
                key={s.key} id={`pipe-${tpl.key}-${s.key}`} name={s.key} label={s.label[locale]} variant="secondary" isDisabled={isPending}
                value={String(values[s.key] ?? "")} onValueChange={(v) => setValues((p) => ({ ...p, [s.key]: s.kind === "number" ? (v === "" ? "" : Number(v)) : v }))}
              />
            ))}
          </div>
          <div className={ACTIONS_CLASS}><Button variant="primary" isPending={isPending} onPress={() => save(enabled)}>{t("pipeSave")}</Button></div>
        </div>
      ) : null}
      {note ? <div className="w-full"><Alert title={note.text} tone={note.tone} /></div> : null}
    </div>
  )
}

/** "Email tự động": the shared n8n email pipelines (switch on/off, settings and wording) and the latest emails with their result. */
export const PipelinesSection = ({ rows, log }: PipelinesSectionProps) => {
  const t = useT(email)
  return (
    <SurfaceCard label={t("pipesTitle")} headingLevel={2}>
      <div className={STACK_CLASS}>
        <Text size="sm" tone="muted">{t("pipesIntro")}</Text>
        <div>{N8N_TEMPLATES.map((tpl) => <PipelineRowView key={tpl.key} tpl={tpl} row={rows.find((r) => r.key === tpl.key)} />)}</div>
        <Text size="sm" weight="semibold">{t("pipeHistory")}</Text>
        {log.length === 0 ? <Text size="sm" tone="muted">{t("pipeHistoryEmpty")}</Text> : null}
        <div>
          {log.map((m) => (
            <div key={m.id} className={ROW_CLASS}>
              <div className={ROW_MAIN_CLASS}>
                <Text size="sm" weight="semibold">{m.subject || m.purpose}</Text>
                <Text size="xs" tone="muted">{m.to} · {new Date(m.at).toLocaleString("vi-VN")}</Text>
                {m.error ? <Text size="xs" tone="muted">{m.error}</Text> : null}
              </div>
              <Badge tone={m.status === "sent" ? "success" : m.status === "waiting_decision" ? "warning" : "danger"}>{t(STATUS_KEY[m.status] ?? "statusFailed")}</Badge>
            </div>
          ))}
        </div>
      </div>
    </SurfaceCard>
  )
}
