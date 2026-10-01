"use client"

import { Badge, Button, IconButton, Text } from "@starci/grammar/common"
import { nivoIconSource } from "@/ui"
import { AgentAvatar, PersonAvatar } from "@/components/avatar/PersonAvatar"
import { useLocale, useT } from "@/i18n/client"
import { office } from "@/i18n/dict/office"
import type { Agent, ModuleKey, ResponsibilityWithLead } from "@/lib/types"
import type { WorkItemView } from "@/lib/flow-types"
import { PendingList } from "./approvals"
import { ExceptionList } from "./exceptions"
import {
  COLUMN_HEAD_CLASS_NAME,
  HEAD_TEXT_CLASS_NAME,
  INFO_BODY_CLASS_NAME,
  INFO_SECTION_CLASS_NAME,
  INFO_TITLE_CLASS_NAME,
  MEMBER_ACTIONS_CLASS_NAME,
  MEMBER_ROW_CLASS_NAME,
  MEMBER_TEXT_CLASS_NAME,
} from "./classNames"
import type { OfficeStaffMember } from "./composer"
import { formatStamp } from "./format"
import type { PendingApproval } from "./queries"

/** One real account in the workspace, as the member panel draws it. */
export type OfficePerson = {
  readonly userId: string
  readonly name: string
  readonly role: "owner" | "manager" | "staff"
  readonly staffId: string | null
  /** @handle when the account is a staff member (they can be mentioned). */
  readonly handle: string | null
  /** Last sign-in (ISO), the cheap "last seen". */
  readonly lastSeenIso: string | null
  readonly isMe: boolean
}

const ONLINE_MS = 15 * 60_000
const MIN_MS = 60_000

/** Props for {@link InfoPanel}. */
export type InfoPanelProps = {
  readonly avatarUrl: string | null
  readonly agents: ReadonlyArray<Agent>
  /** Real accounts of this workspace: owner, managers and staff. */
  readonly people: ReadonlyArray<OfficePerson>
  /** Staff rows nobody has signed in as yet (not invited, or invite pending). */
  readonly staff?: ReadonlyArray<OfficeStaffMember>
  readonly pending: ReadonlyArray<PendingApproval>
  readonly exceptions: ReadonlyArray<WorkItemView>
  readonly tasks: ReadonlyArray<ResponsibilityWithLead>
  readonly moduleOf: (agentId: string | null) => ModuleKey | undefined
  readonly onJump: (executionId: string) => void
  readonly onJumpException: (workItemId: string) => void
  readonly onMention: (handle: string) => void
  readonly onOpenTasks: () => void
  readonly onClose: () => void
}

/** Right column: what waits for approval, who is in the chat, and the team's tasks. */
export const InfoPanel = ({ avatarUrl, agents, people, staff = [], pending, exceptions, tasks, moduleOf, onJump, onJumpException, onMention, onOpenTasks, onClose }: InfoPanelProps) => {
  const t = useT(office)
  const locale = useLocale()
  const lastSeen = (person: OfficePerson): { readonly text: string; readonly online: boolean } => {
    if (!person.lastSeenIso) return { text: t("neverSeen"), online: false }
    const ago = Date.now() - new Date(person.lastSeenIso).getTime()
    if (ago < ONLINE_MS) return { text: t("seenNow"), online: true }
    if (ago < 60 * MIN_MS) return { text: t("seenMinutes", { n: Math.max(1, Math.round(ago / MIN_MS)) }), online: false }
    return { text: t("seenAt", { time: formatStamp(person.lastSeenIso, locale) }), online: false }
  }
  const roleLabel = (role: OfficePerson["role"]) => (role === "owner" ? t("owner") : role === "manager" ? t("roleManager") : t("staffTag"))
  const openTasks = tasks.filter((task) => task.status !== "done").length
  return (
    <>
      <div className={COLUMN_HEAD_CLASS_NAME}>
        <div className={HEAD_TEXT_CLASS_NAME}>
          <Text weight="semibold">{t("infoTitle")}</Text>
        </div>
        <IconButton source={nivoIconSource("close", "leading")} label={t("infoClose")} onPress={onClose} />
      </div>
      <div className={INFO_BODY_CLASS_NAME}>
        <PendingList items={pending} moduleOf={moduleOf} onJump={onJump} />
        <ExceptionList items={exceptions} onJump={onJumpException} />

        <section className={INFO_SECTION_CLASS_NAME} aria-label={t("membersTitle")}>
          <div className={INFO_TITLE_CLASS_NAME}>
            <Text weight="semibold">{t("membersTitle")}</Text>
            <Text size="sm" tone="muted">{`${agents.length + staff.length + people.length}`}</Text>
          </div>
          {people.map((person) => {
            const seen = lastSeen(person)
            return (
              <div key={person.userId} className={MEMBER_ROW_CLASS_NAME} data-testid="office-person">
                <PersonAvatar name={person.name} src={person.isMe ? avatarUrl : null} online={person.isMe || seen.online} />
                <div className={MEMBER_TEXT_CLASS_NAME}>
                  <Text weight="medium" overflow="truncate">{person.name}</Text>
                  <Text size="sm" tone="muted" overflow="truncate">{[roleLabel(person.role), person.handle ? `@${person.handle}` : null].filter(Boolean).join(" · ")}</Text>
                  {person.isMe ? null : <Text size="xs" tone="muted" overflow="truncate">{seen.text}</Text>}
                  {person.handle && !person.isMe ? (
                    <div className={MEMBER_ACTIONS_CLASS_NAME}>
                      <Button variant="ghost" size="sm" onPress={() => onMention(person.handle ?? "")}>{t("mention")}</Button>
                    </div>
                  ) : null}
                </div>
                {person.isMe ? <Badge tone="accent">{t("youTag")}</Badge> : null}
              </div>
            )
          })}
          {staff.map((member) => (
            <div key={member.id} className={MEMBER_ROW_CLASS_NAME}>
              <PersonAvatar name={member.name} />
              <div className={MEMBER_TEXT_CLASS_NAME}>
                <Text weight="medium" overflow="truncate">{member.name}</Text>
                <Text size="sm" tone="muted" overflow="truncate">{`@${member.handle} · ${member.role || t("staffTag")}`}</Text>
                <Text size="xs" tone="muted">{t("noAccountYet")}</Text>
                <div className={MEMBER_ACTIONS_CLASS_NAME}>
                  <Button variant="ghost" size="sm" onPress={() => onMention(member.handle)}>{t("mention")}</Button>
                </div>
              </div>
            </div>
          ))}
          {agents.map((agent) => {
            const isActive = agent.status === "active"
            return (
              <div key={agent.id} className={MEMBER_ROW_CLASS_NAME}>
                <AgentAvatar module={agent.module} label={agent.name} online={isActive} />
                <div className={MEMBER_TEXT_CLASS_NAME}>
                  <Text weight="medium" overflow="truncate">{agent.name}</Text>
                  <Text size="sm" tone="muted" overflow="truncate">{isActive ? `@${agent.handle} · ${agent.role}` : t("paused")}</Text>
                  <div className={MEMBER_ACTIONS_CLASS_NAME}>
                    {isActive ? <Button variant="ghost" size="sm" onPress={() => onMention(agent.handle)}>{t("mention")}</Button> : null}
                    <Button variant="ghost" size="sm" href={`/modules/${agent.id}/chat`}>{t("chat11")}</Button>
                  </div>
                </div>
              </div>
            )
          })}
          <Button variant="outline" size="sm" width="fill" href="/m">{t("addAgent")}</Button>
        </section>

        <section className={INFO_SECTION_CLASS_NAME} aria-label={t("tasksTitle")}>
          <div className={INFO_TITLE_CLASS_NAME}>
            <Text weight="semibold">{t("tasksTitle")}</Text>
          </div>
          <Text size="sm" tone="muted">{t("tasksSummary", { open: openTasks, total: tasks.length })}</Text>
          <Button variant="secondary" size="sm" width="fill" onPress={onOpenTasks}>{t("tasksOpen")}</Button>
        </section>
      </div>
    </>
  )
}
