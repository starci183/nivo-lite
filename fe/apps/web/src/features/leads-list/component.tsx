"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { PersonAvatar } from "@/components/avatar/PersonAvatar"
import { Badge, DropdownMenu, IconButton, ListItem, Text } from "@starci/grammar/common"
import { nivoIconSource } from "@/ui"
import type { LeadRow } from "@/lib/queries"
import { suggestResponsibility } from "@/lib/actions"
import { useLocale, useT } from "@/i18n/client"
import { leads as leadsDict } from "@/i18n/dict/leads"
import { ROW_ACTIONS_CLASS, ROW_LINK_CLASS, ROW_META_CLASS, ROW_BODY_CLASS, ROW_CLASS, ITEM_CLASS, ROW_TITLE_CLASS } from "./classNames"
import { channelLabel, STAGE_VIEW, timeAgo } from "./stage"

/** Props for {@link LeadListRow}. */
export type LeadListRowProps = { readonly lead: LeadRow; readonly nowIso: string }

/** One contact-list row of the SurfaceListCard: avatar, name, next step, relative time, stage badge; the row link opens the lead, the menu sits beside it. */
export const LeadListRow = ({ lead, nowIso }: LeadListRowProps) => {
  const router = useRouter()
  const t = useT(leadsDict)
  const locale = useLocale()
  const [isPending, startTransition] = useTransition()
  const [failure, setFailure] = useState<string | null>(null)
  const stage = STAGE_VIEW[lead.stage]

  const onPropose = () => {
    setFailure(null)
    startTransition(async () => {
      const result = await suggestResponsibility(lead.id)
      if (result.ok) router.refresh()
      else setFailure(result.error)
    })
  }

  const entries = [
    { id: "open", label: t("rowOpenLead"), href: `/leads/${lead.id}` },
    { id: "office", label: t("rowOffice"), href: "/chat" },
    ...(lead.owner_name ? [] : [{ id: "propose", label: t("rowPropose"), onAction: onPropose }]),
  ]

  const subtitle = lead.next_action ? t("rowNext", { next: lead.next_action }) : lead.need
  const who = `${lead.company} · ${lead.owner_name ? t("ownerYou", { name: lead.owner_name }) : t("rowNoOwner")}`

  return (
    <ListItem className={ITEM_CLASS}>
      <div className={ROW_CLASS}>
        <Link href={`/leads/${lead.id}`} className={ROW_LINK_CLASS}>
          <PersonAvatar name={lead.contact_name} size="md" />
          <div className={ROW_BODY_CLASS}>
            <div className={ROW_TITLE_CLASS}>
              <Text weight="semibold" overflow="truncate">{lead.contact_name}</Text>
              <Text as="span" size="xs" tone="muted">{timeAgo(lead.created_at, nowIso, t, locale)}</Text>
            </div>
            <Text size="sm" overflow="truncate">{subtitle}</Text>
            <div className={ROW_META_CLASS}>
              <Badge tone={stage.tone} isDot>{t(stage.key)}</Badge>
              <Text size="xs" tone="muted" overflow="truncate">{who}</Text>
            </div>
          </div>
        </Link>
        <div className={ROW_ACTIONS_CLASS}>
          <DropdownMenu
            placement="bottom end"
            entries={entries}
            trigger={<IconButton source={nivoIconSource("more", "leading")} label={t("rowMore")} isDisabled={isPending} />}
          />
        </div>
      </div>
      {failure ? <Text size="xs" live="polite">{failure}</Text> : null}
    </ListItem>
  )
}
