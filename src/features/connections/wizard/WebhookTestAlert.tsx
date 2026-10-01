"use client"

import { Alert } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { webhookWizard } from "@/i18n/dict/webhookWizard"
import type { WebhookTestResult } from "@/lib/webhook-actions"

/** What the receiver answered to a test send: affirmative on 2xx, otherwise the reason. */
export const WebhookTestAlert = ({ result }: { readonly result: WebhookTestResult }) => {
  const t = useT(webhookWizard)
  const took = t("testTook", { ms: result.durationMs })
  return result.ok
    ? <Alert tone="affirmative" title={t("testOk", { status: result.status ?? "" })} description={took} />
    : <Alert tone="negative" title={t("testFailed")} description={`${result.error ?? ""} ${took}`.trim()} />
}
