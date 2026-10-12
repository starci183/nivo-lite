"use client"

import { Badge, SurfaceCard, Text } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { inbox as dict } from "@/i18n/dict/inbox"
import { BANK_CONNECTION } from "@/lib/bank"
import { BANK_HEAD_CLASS, STACK_TIGHT_CLASS } from "./classNames"

/** The workspace's bank connection (simulated): bank name as text, masked account, and an always-visible "simulated" chip. */
export const BankConnection = () => {
  const t = useT(dict)
  return (
    <SurfaceCard label={t("bankTitle")} ariaLabel={t("bankTitle")}>
      <div className={STACK_TIGHT_CLASS}>
        <div className={BANK_HEAD_CLASS}>
          <Text weight="semibold">{BANK_CONNECTION.name}</Text>
          <Text tone="muted" size="sm">{BANK_CONNECTION.account}</Text>
          {BANK_CONNECTION.simulated ? <Badge tone="warning">{t("bankSimulated")}</Badge> : null}
        </div>
        <Text size="sm" tone="muted">{t("bankNote")}</Text>
      </div>
    </SurfaceCard>
  )
}
