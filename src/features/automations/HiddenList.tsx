"use client"

import { Button, Text } from "@starci/grammar/common"
import { useLocale, useT } from "@/i18n/client"
import { automations as dict } from "@/i18n/dict/automations"
import type { AutomationCardView } from "@/lib/automation-shared"
import { DISCLOSURE_CLASS, HIDDEN_ROW_CLASS } from "./classNames"
import { loc } from "./helpers"

/** Props for {@link HiddenList}. */
export type HiddenListProps = { readonly cards: ReadonlyArray<AutomationCardView>; readonly busyKey: string | null; readonly onRestore: (key: string) => void }

/** "Đã ẩn (n)": the automations the owner marked "Không áp dụng", each with "Khôi phục". */
export const HiddenList = ({ cards, busyKey, onRestore }: HiddenListProps) => {
  const t = useT(dict)
  const locale = useLocale()
  if (cards.length === 0) return null
  return (
    <details className={DISCLOSURE_CLASS}>
      <summary>{t("hiddenCount", { n: cards.length })}</summary>
      <div>
        {cards.map((c) => (
          <div key={c.key} className={HIDDEN_ROW_CLASS}>
            <Text size="sm">{loc(c.def.name, locale)}</Text>
            <Button variant="outline" size="sm" isDisabled={busyKey === c.key} onPress={() => onRestore(c.key)}>{t("restore")}</Button>
          </div>
        ))}
      </div>
    </details>
  )
}
