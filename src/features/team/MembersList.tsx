"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Alert, AlertDialog, Badge, Button, DataTable, DropdownMenu, Region, SectionHeader, Text, type DataTableColumn, type DropdownMenuEntry } from "@starci/grammar/common"
import { PersonAvatar } from "@/components/avatar/PersonAvatar"
import { intlLocale, TIME_ZONE } from "@/i18n/core"
import { useLocale, useT } from "@/i18n/client"
import { team } from "@/i18n/dict/team"
import { changeMemberRole, removeMember, setMemberStatus } from "@/lib/team-actions"
import type { MemberListing } from "@/lib/members"
import type { Role } from "@/lib/members-shared"
import type { Outcome } from "@/lib/types"
import { IDENTITY_CLASS, IDENTITY_TEXT_CLASS, NAME_LINE_CLASS, SECTION_CLASS } from "./classNames"

/** Props for {@link MembersList}. */
export type MembersListProps = {
  readonly members: ReadonlyArray<MemberListing>
  readonly staffNames: Readonly<Record<string, string>>
  readonly selfId: string
  readonly selfRole: Role
}

type Confirm = { readonly userId: string; readonly kind: "remove" | "disable" }

type MemberRow = { readonly id: string; readonly member: MemberListing }

const ROLE_KEY = { owner: "roleOwner", manager: "roleManager", staff: "roleStaff" } as const

/** Members of the workspace as a DataTable: who they are, role, status, last sign-in, the actions an owner | manager has on them, and an AlertDialog for remove / disable. */
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
        setConfirm(null)
        if (result.ok) router.refresh()
        else setError(result.error)
      } catch (e) {
        setConfirm(null)
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

  const asking = confirm ? members.find((m) => m.userId === confirm.userId) ?? null : null
  const askTitle = confirm && asking
    ? (confirm.kind === "remove" ? t("confirmRemoveTitle", { name: asking.displayName }) : t("confirmDisableTitle", { name: asking.displayName }))
    : ""

  const columns: ReadonlyArray<DataTableColumn> = [
    { id: "member", label: t("colMember"), isRowHeader: true },
    { id: "role", label: t("colRole") },
    { id: "status", label: t("colStatus") },
    { id: "lastSignIn", label: t("colLastSignIn") },
    { id: "actions", label: t("colActions"), align: "end" },
  ]

  const renderCell = ({ member: m }: MemberRow, columnId: string) => {
    if (columnId === "member") {
      const staffName = m.staffId ? staffNames[m.staffId] : null
      return (
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
      )
    }
    if (columnId === "role") return <Text size="sm" weight="medium">{t(ROLE_KEY[m.role])}</Text>
    if (columnId === "status") return <Badge tone={m.status === "active" ? "success" : "neutral"}>{m.status === "active" ? t("statusActive") : t("statusDisabled")}</Badge>
    if (columnId === "lastSignIn") return <Text size="sm">{when(m.lastSignInAt)}</Text>
    const locked = m.role === "owner" && selfRole !== "owner"
    return locked ? null : (
      <DropdownMenu
        placement="bottom end"
        entries={entriesFor(m)}
        trigger={<Button variant="outline" isPending={isPending} aria-label={t("rowMore", { name: m.displayName })}>{t("colActions")}</Button>}
      />
    )
  }

  return (
    <Region labelledBy="team-members-title" className={SECTION_CLASS}>
      <SectionHeader id="team-members-title" level={2} title={t("membersTitle")} description={t("membersDesc", { count: members.length })} />
      {error ? <Alert title={t("errGeneric")} description={error} tone="negative" /> : null}
      <DataTable
        label={t("membersTitle")}
        columns={columns}
        rows={members.map((m): MemberRow => ({ id: m.userId, member: m }))}
        renderCell={renderCell}
        emptyContent={null}
      />
      <AlertDialog
        isOpen={confirm !== null && asking !== null}
        onOpenChange={(open) => { if (!open) setConfirm(null) }}
        title={askTitle}
        description={confirm?.kind === "remove" ? t("confirmRemoveBody") : t("confirmDisableBody")}
        tone="negative"
        confirmLabel={confirm?.kind === "remove" ? t("confirmYesRemove") : t("confirmYesDisable")}
        cancelLabel={t("confirmNo")}
        isConfirmPending={isPending}
        onConfirm={() => {
          if (!confirm) return
          const { userId, kind } = confirm
          run(() => (kind === "remove" ? removeMember(userId) : setMemberStatus(userId, "disabled")))
        }}
        onCancel={() => setConfirm(null)}
      />
    </Region>
  )
}
