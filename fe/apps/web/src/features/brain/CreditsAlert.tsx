"use client"

import { useRouter } from "next/navigation"
import { Alert } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { brain } from "@/i18n/dict/brain"

/** The workspace is out of credits: documents are saved, but their facts are not read until credits are topped up (soft banner with a way to Billing). */
export const CreditsAlert = () => {
  const t = useT(brain)
  const router = useRouter()
  return <Alert tone="cautionary" appearance="soft" title={t("creditsOut")} action={{ label: t("creditsTopUp"), onAction: () => router.push("/billing") }} />
}
