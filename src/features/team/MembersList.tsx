"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Alert, Badge, Button, DropdownMenu, SurfaceCard, Text, type DropdownMenuEntry } from "@starci/grammar/common"
import { PersonAvatar } from "@/components/avatar/PersonAvatar"
import { intlLocale, TIME_ZONE } from "@/i18n/core"
import { useLocale, useT } from "@/i18n/client"
import { team } from "@/i18n/dict/team"
import { changeMemberRole, removeMember, setMemberStatus } from "@/lib/team-actions"
import type { MemberListing } from "@/lib/members"
import type { Role } from "@/lib/members-shared"
import type { Outcome } from "@/lib/types"
import { ACTIONS_CLASS, CONFIRM_CLASS, FACTS_CLASS, FACT_CLASS, IDENTITY_CLASS, IDENTITY_TEXT_CLASS, NAME_LINE_CLASS, ROW_CLASS, STACK_CLASS } from "./classNames"

/** Props for {@link MembersList}. */
export type MembersListProps = {
  readonly members: ReadonlyArray<MemberListing>
  readonly staffNames: Readonly<Record<string, string>>
  readonly selfId: string
  readonly selfRole: Role
}

type Confirm = { readonly userId: string; readonly kind: "remove" | "disable" }

const ROLE_KEY = { owner: "roleOwner", manager: "roleManager", staff: "roleStaff" } as const

/** Members of the workspace: who they are, role, status, last sign-in, and the actions an owner | manager has on them. */
export const MembersList = ({ members, staffNames, selfId, selfRole }: MembersListProps) => {
  const t = useT(team)
  const locale = useLocale()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<Confirm | null>(null)

  const run = (job: () => Promise<Outcome<unknown>>) => {
    setError(null)
    startTransition(async () => {
      try {
        const result = await job()
        if (result.ok) {
          setConfirm(null)
          router.refresh()
        } else setError(result.error)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })
  }

  const when = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium", timeStyle: "short", timeZone: TIME_ZONE }).format(new Date(iso)) : t("neverSignedIn")

  const entriesFor = (m: MemberListing): DropdownMenuEntry[] => {
    const isSelf = m.userId === selfId
    const roles: Role[] = selfRole === "owner" ? ["owner", "manager", "staff"] : ["manager", "staff"]
    const sections: DropdownMenuEntry[] = [
      {
        kind: "section",
        id: "role",
        label: t("colRole"),
        items: roles.map((r) => ({ id: `role:${r}`, label: t(ROLE_KEY[r]) })),
        selection: {
          mode: "single",
          selectedIds: [`role:${m.role}`],
          onChange: (ids) => {
            const r = ids[0]?.replace("role:", "") as Role | undefined
            if (r && r !== m.role) run(() => changeMemberRole(m.userId, r))
          },
        },
      },
    ]
    if (!isSelf) {
      sections.push({
        kind: "section",
        id: "access",
        items: [
          m.status === "active"
            ? { id: "disable", label: t("actionDisable"), onAction: () => setConfirm({ userId: m.userId, kind: "disable" }) }
            : { id: "enable", label: t("actionEnable"), onAction: () => run(() => setMemberStatus(m.userId, "active")) },
          { id: "remove", label: t("actionRemove"), tone: "negative", onAction: () => setConfirm({ userId: m.userId, kind: "remove" }) },
        ],
      })
    }
    return sections
  }

  return (
    <SurfaceCard label={t("membersTitle")} headingLevel={2}>
      <div className={STACK_CLASS}>
        <Text size="sm" tone="muted">{t("membersDesc", { count: members.length })}</Text>
        {error ? <Alert title={t("errGeneric")} description={error} tone="negative" /> : null}
        <ul>
          {members.map((m) => {
            const locked = m.role === "owner" && selfRole !== "owner"
            const staffName = m.staffId ? staffNames[m.staffId] : null
            const asking = confirm?.userId === m.userId ? confirm : null
            const askTitle = asking ? (asking.kind === "remove" ? t("confirmRemoveTitle", { name: m.displayName }) : t("confirmDisableTitle", { name: m.displayName })) : ""
            return (
              <li key={m.userId} className={ROW_CLASS}>
                <div className={IDENTITY_CLASS}>
                  <PersonAvatar name={m.displayName} size="md" />
                  <div className={IDENTITY_TEXT_CLASS}>
                    <div className={NAME_LINE_CLASS}>
                      <Text weight="semibold" overflow="truncate">{m.displayName}</Text>
                      {m.userId === selfId ? <Badge tone="neutral">{t("you")}</Badge> : null}
                    </div>
                    <Text size="sm" tone="muted" overflow="truncate">{m.email}</Text>
                    {staffName ? <Text size="xs" tone="muted" overflow="truncate">{t("linkedStaff", { name: staffName })}</Text> : null}
                  </div>
                </div>
                <div className={FACTS_CLASS}>
                  <div className={FACT_CLASS}>
                    <Text size="xs" tone="muted">{t("colRole")}</Text>
                    <Text size="sm" weight="medium">{t(ROLE_KEY[m.role])}</Text>
                  </div>
                  <div className={FACT_CLASS}>
                    <Text size="xs" tone="muted">{t("colStatus")}</Text>
                    <span><Badge tone={m.status === "active" ? "success" : "neutral"}>{m.status === "active" ? t("statusActive") : t("statusDisabled")}</Badge></span>
                  </div>
                  <div className={FACT_CLASS}>
                    <Text size="xs" tone="muted">{t("colLastSignIn")}</Text>
                    <Text size="sm">{when(m.lastSignInAt)}</Text>
                  </div>
                </div>
                <div className={ACTIONS_CLASS}>
                  {locked ? null : (
                    <DropdownMenu
                      placement="bottom end"
                      entries={entriesFor(m)}
                      trigger={<Button variant="outline" isPending={isPending} aria-label={t("rowMore", { name: m.displayName })}>{t("colActions")}</Button>}
                    />
                  )}
                </div>
                {asking ? (
                  <div className={CONFIRM_CLASS} role="alertdialog" aria-label={askTitle}>
                    <Text weight="semibold">{askTitle}</Text>
                    <Text size="sm" tone="muted">{asking.kind === "remove" ? t("confirmRemoveBody") : t("confirmDisableBody")}</Text>
                    <div className={ACTIONS_CLASS}>
                      <Button variant="secondary" isPending={isPending} onPress={() => run(() => (asking.kind === "remove" ? removeMember(m.userId) : setMemberStatus(m.userId, "disabled")))}>
                        {asking.kind === "remove" ? t("confirmYesRemove") : t("confirmYesDisable")}
                      </Button>
                      <Button variant="ghost" onPress={() => setConfirm(null)}>{t("confirmNo")}</Button>
                    </div>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      </div>
    </SurfaceCard>
  )
}
