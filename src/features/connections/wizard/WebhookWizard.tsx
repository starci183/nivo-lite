"use client"

import { useState, useTransition } from "react"
import { Alert, Button, CheckboxGroup, Input, Text } from "@starci/grammar/common"
import { useLocale, useT } from "@/i18n/client"
import { connectionWizard } from "@/i18n/dict/connectionWizard"
import { webhookWizard } from "@/i18n/dict/webhookWizard"
import { finishWebhookConnection, sendWebhookTest, startWebhookConnection, type WebhookTestResult, type WebhookView } from "@/lib/webhook-actions"
import { WEBHOOK_EVENTS, WEBHOOK_EVENT_LABEL } from "@/lib/webhook-shared"
import { CodeBlock } from "../CodeBlock"
import { CopyField } from "../CopyField"
import { FIELDS_CLASS, NUMBERED_CLASS } from "./classNames"
import { N8N_VERIFY_SNIPPET } from "./webhookSnippet"
import { WebhookTestAlert } from "./WebhookTestAlert"
import { WizardFrame } from "./WizardFrame"

/** n8n / Make / Zapier webhook in the shared wizard frame: address and events, signing secret, a test send, done. */
export const WebhookWizard = ({ onClose }: { readonly onClose: (changed: boolean) => void }) => {
  const t = useT(webhookWizard)
  const c = useT(connectionWizard)
  const locale = useLocale()
  const [index, setIndex] = useState(0)
  const [name, setName] = useState(t("defaultName"))
  const [url, setUrl] = useState("")
  const [events, setEvents] = useState<Array<string>>([...WEBHOOK_EVENTS])
  const [created, setCreated] = useState<WebhookView | null>(null)
  const [test, setTest] = useState<WebhookTestResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const fail = (message: string) => setError(message)
  const save = () => startTransition(async () => {
    setError(null)
    const r = await startWebhookConnection({ name, url, events })
    if (!r.ok) return fail(r.error)
    setCreated(r.data)
    setIndex(1)
  })
  const sendTest = () => created ? startTransition(async () => {
    setError(null)
    const r = await sendWebhookTest(created.id)
    if (!r.ok) return fail(r.error)
    setTest(r.data)
  }) : undefined
  const finish = () => created ? startTransition(async () => {
    setError(null)
    const r = await finishWebhookConnection(created.id)
    if (!r.ok) return fail(r.error)
    onClose(true)
  }) : undefined

  const footers = [
    <><Button variant="primary" isPending={isPending} isDisabled={!name.trim() || !url.trim() || events.length === 0} onPress={save}>{t("saveAndNext")}</Button><Button variant="ghost" isDisabled={isPending} onPress={() => onClose(false)}>{c("close")}</Button></>,
    <><Button variant="primary" onPress={() => setIndex(2)}>{c("next")}</Button></>,
    <><Button variant="primary" isDisabled={!test} onPress={() => setIndex(3)}>{c("next")}</Button><Button variant={test ? "outline" : "secondary"} isPending={isPending} onPress={sendTest}>{test ? t("sendAgain") : t("sendTest")}</Button></>,
    <><Button variant="primary" isPending={isPending} onPress={finish}>{t("finish")}</Button><Button variant="outline" isDisabled={isPending} onPress={() => setIndex(2)}>{c("back")}</Button></>,
  ]
  return (
    <WizardFrame title={t("title")} steps={[t("stepAddress"), t("stepSecret"), t("stepTest"), t("stepDone")]} index={index} footer={footers[index]}>
      {index === 0 ? (
        <>
          <div className={FIELDS_CLASS}>
            <Input id="webhook-name" name="name" label={t("fieldName")} variant="secondary" isDisabled={isPending} value={name} onValueChange={setName} />
            <Input id="webhook-url" name="url" label={t("fieldUrl")} variant="secondary" placeholder="https://" hint={t("urlHint")} isDisabled={isPending} value={url} onValueChange={setUrl} />
          </div>
          <CheckboxGroup
            label={t("eventsLabel")}
            isDisabled={isPending}
            options={WEBHOOK_EVENTS.map((e) => ({ value: e, label: WEBHOOK_EVENT_LABEL[e][locale] }))}
            value={events}
            onValueChange={setEvents}
          />
        </>
      ) : null}
      {index === 1 && created ? (
        <>
          <Text size="sm" tone="muted">{t("secretIntro")}</Text>
          <CopyField label={t("secretLabel")} value={created.signingSecret} secret />
          <Text weight="semibold">{t("n8nTitle")}</Text>
          <ol className={NUMBERED_CLASS}><li>{t("n8nStep1")}</li><li>{t("n8nStep2")}</li><li>{t("n8nStep3")}</li></ol>
          <CodeBlock label={t("codeLabel")} code={N8N_VERIFY_SNIPPET} />
          <Text size="xs" tone="muted">{t("n8nNote")}</Text>
        </>
      ) : null}
      {index === 2 ? (
        <>
          <Text size="sm" tone="muted">{t("testIntro")}</Text>
          {test ? <WebhookTestAlert result={test} /> : null}
          {test && !test.ok ? <Text size="sm" tone="muted">{t("testWarn")}</Text> : null}
        </>
      ) : null}
      {index === 3 ? <Text size="sm" tone="muted">{t("doneIntro")}</Text> : null}
      {error ? <Alert tone="negative" title={error} /> : null}
    </WizardFrame>
  )
}
