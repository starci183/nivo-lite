"use client"

import { Button, Disclosure, List, ListItem, Text } from "@starci/grammar/common"
import { useLocale, useT } from "@/i18n/client"
import { automations as dict } from "@/i18n/dict/automations"
import type { AutomationCardView } from "@/lib/automation-shared"
import { HIDDEN_ROW_CLASS, ROWS_CLASS } from "./classNames"
import { loc } from "./helpers"

/** Props for {@link HiddenList}. */
export type HiddenListProps = { readonly cards: ReadonlyArray<AutomationCardView>; readonly busyKey: string | null; readonly onRestore: (key: string) => void }

/** "Đã ẩn (n)": the automations the owner marked "Không áp dụng", each with "Khôi phục". */
export const HiddenList = ({ cards, busyKey, onRestore }: HiddenListProps) => {
  const t = useT(dict)
  const locale = useLocale()
  if (cards.length === 0) return null
  return (
    <Disclosure title={t("hiddenCount", { n: cards.length })}>
      <List label={t("hiddenCount", { n: cards.length })} className={ROWS_CLASS}>
        {cards.map((c) => (
          <ListItem key={c.key} className={HIDDEN_ROW_CLASS}>
            <Text size="sm">{loc(c.def.name, locale)}</Text>
            <Button variant="outline" size="sm" isDisabled={busyKey === c.key} onPress={() => onRestore(c.key)}>{t("restore")}</Button>
          </ListItem>
        ))}
      </List>
    </Disclosure>
  )
}
