"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { Button, EmptyNotice, Heading, Icon, IconButton, Text } from "@starci/grammar/common"
import { nivoIconSource } from "@/ui"
import { useLocale, useT } from "@/i18n/client"
import { office } from "@/i18n/dict/office"
import { sendTeamMessage } from "@/lib/actions"
import { supabaseBrowser } from "@/lib/supabase/browser"
import type { Agent, Message, ModuleKey, ResponsibilityWithLead } from "@/lib/types"
import { OfficePromoCard } from "@/features/promo-ads/OfficePromoCard"
import type { Staff, WorkItemView } from "@/lib/flow-types"
import { ApprovalBubble, approvalAnchor } from "./approvals"
import {
  BACK_GLYPH_CLASS_NAME,
  COLUMN_HEAD_CLASS_NAME,
  HEAD_AVATAR_CLASS_NAME,
  NARROW_ONLY_CLASS_NAME,
  WIDE_ONLY_CLASS_NAME,
  HEAD_ACTIONS_CLASS_NAME,
  HEAD_TEXT_CLASS_NAME,
  INFO_COLUMN_CLASS_NAME,
  LIST_COLUMN_CLASS_NAME,
  MESSENGER_CLASS_NAME,
  PHONE_HIDDEN_CLASS_NAME,
  PHONE_ONLY_CLASS_NAME,
  PROMO_SLOT_CLASS_NAME,
  TASKS_SCROLL_CLASS_NAME,
  THREAD_BODY_CLASS_NAME,
  THREAD_COLUMN_CLASS_NAME,
  THREAD_SCROLL_CLASS_NAME,
  TYPING_CLASS_NAME,
} from "./classNames"
import { Composer, type OfficeStaffMember } from "./composer"
import { staffHandles } from "@/lib/staff-handle"
import { ExceptionCard, exceptionAnchor } from "./exceptions"
import { ConversationList, type CustomerEntry } from "./conversations"
import { InfoPanel } from "./members"
import { DaySeparator, MessageRow, PendingBubble } from "./messages"
import type { PendingApproval } from "./queries"
import { TasksPanel } from "./tasks"
import { buildThread } from "./timeline"
import { useFillViewport } from "./useFillViewport"

export type { CustomerEntry } from "./conversations"

/** Props for {@link OfficeMessenger}. */
export type OfficeMessengerProps = {
  readonly workspaceId: string
  readonly workspaceName: string
  readonly userName: string
  readonly avatarUrl: string | null
  readonly initialMessages: ReadonlyArray<Message>
  readonly agents: ReadonlyArray<Agent>
  readonly pending: ReadonlyArray<PendingApproval>
  readonly decided: ReadonlyArray<PendingApproval>
  /** Work items waiting for a person (needs decision or failed), oldest first. */
  readonly exceptions: ReadonlyArray<WorkItemView>
  /** Recently decided exception cards, kept in the thread as a record. */
  readonly decidedExceptions: ReadonlyArray<WorkItemView>
  readonly staff: ReadonlyArray<Staff>
  /** Approvals plus exceptions, counted once (from the governance query). */
  readonly pendingDecisions: number
  readonly tasks: ReadonlyArray<ResponsibilityWithLead>
  readonly customers: ReadonlyArray<CustomerEntry>
  /** Lead id to contact name, for lead chips on system notices. */
  readonly leadNames: Readonly<Record<string, string>>
  /** Render time (ISO) fixed on the server so day labels agree with hydration. */
  readonly nowIso: string
}

const WIDE_INFO_QUERY = "(min-width: 1280px)"
const FOCUS_MS = 2400
const REFRESH_DEBOUNCE_MS = 700

/**
 * Office as a messenger (Zalo-like): conversation list on the left, the team thread filling the
 * height with its composer pinned at the bottom, and a collapsible info panel on the right.
 * Approval requests live inside the thread; the header carries one "Needs approval (n)" chip.
 */
export const OfficeMessenger = ({
  workspaceId,
  workspaceName,
  userName,
  avatarUrl,
  initialMessages,
  agents,
  pending,
  decided,
  exceptions,
  decidedExceptions,
  staff,
  pendingDecisions,
  tasks,
  customers,
  leadNames,
  nowIso,
}: OfficeMessengerProps) => {
  const router = useRouter()
  const t = useT(office)
  const locale = useLocale()
  const [messages, setMessages] = useState<ReadonlyArray<Message>>(initialMessages)
  const [draft, setDraft] = useState("")
  const [outbox, setOutbox] = useState<ReadonlyArray<{ readonly id: string; readonly body: string; readonly failed: boolean }>>([])
  const [error, setError] = useState<string | null>(null)
  const [typing, setTyping] = useState<string | null>(null)
  const [phoneView, setPhoneView] = useState<"list" | "thread">("thread")
  const [centre, setCentre] = useState<"chat" | "tasks">("chat")
  const [isInfoOpen, setIsInfoOpen] = useState(false)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [sendAs, setSendAs] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const composerHostRef = useRef<HTMLDivElement | null>(null)
  const stickRef = useRef(true)
  const refreshTimer = useRef<number | null>(null)

  useFillViewport(rootRef)

  useEffect(() => {
    setIsInfoOpen(window.matchMedia(WIDE_INFO_QUERY).matches)
  }, [])

  const append = useCallback((incoming: ReadonlyArray<Message>) => {
    // Any person's message clears its optimistic bubble: the owner may be writing as a staff member.
    const mine = incoming.filter((m) => m.author_kind === "human").map((m) => m.body)
    if (mine.length) {
      setOutbox((current) => {
        const rest = [...current]
        for (const body of mine) {
          const at = rest.findIndex((o) => !o.failed && o.body === body)
          if (at >= 0) rest.splice(at, 1)
        }
        return rest.length === current.length ? current : rest
      })
    }
    setMessages((current) => {
      const seen = new Set(current.map((m) => m.id))
      const fresh = incoming.filter((m) => !seen.has(m.id))
      return fresh.length ? [...current, ...fresh] : current
    })
  }, [])

  useEffect(() => {
    const client = supabaseBrowser()
    const channel = client
      .channel(`office-${workspaceId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `workspace_id=eq.${workspaceId}` }, (payload) => {
        append([payload.new as Message])
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "work_items", filter: `workspace_id=eq.${workspaceId}` }, () => {
        if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current)
        refreshTimer.current = window.setTimeout(() => {
          refreshTimer.current = null
          router.refresh()
        }, REFRESH_DEBOUNCE_MS)
      })
      .subscribe()
    return () => {
      if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current)
      void client.removeChannel(channel)
    }
  }, [workspaceId, append, router])

  useEffect(() => {
    const node = scrollRef.current
    if (node) {
      node.scrollTop = node.scrollHeight
      stickRef.current = true
    }
  }, [messages.length, outbox.length, typing, centre, phoneView])

  useEffect(() => {
    const node = scrollRef.current
    if (!node) return
    const onScroll = () => {
      stickRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80
    }
    const observer = new ResizeObserver(() => {
      if (stickRef.current) node.scrollTop = node.scrollHeight
    })
    observer.observe(node)
    if (node.firstElementChild) observer.observe(node.firstElementChild)
    node.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      observer.disconnect()
      node.removeEventListener("scroll", onScroll)
    }
  }, [centre, phoneView])

  const agentById = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents])
  // Staff are people in the group: same @handles as the server derives (active staff, oldest first).
  const members = useMemo<ReadonlyArray<OfficeStaffMember>>(() => {
    const active = staff.filter((s) => s.active)
    const handles = staffHandles(active, agents.map((a) => a.handle))
    return active.map((s) => ({ id: s.id, name: s.name, role: s.role, handle: handles.get(s.id) ?? "" }))
  }, [staff, agents])
  const sendAsId = members.some((m) => m.id === sendAs) ? sendAs : null
  const moduleOf = useCallback((agentId: string | null): ModuleKey | undefined => (agentId ? agentById.get(agentId)?.module : undefined), [agentById])

  const focusComposer = () => composerHostRef.current?.querySelector("textarea")?.focus()

  const onMention = (handle: string) => {
    setDraft((current) => `${current}${current && !current.endsWith(" ") ? " " : ""}@${handle} `)
    setCentre("chat")
    setPhoneView("thread")
    if (!window.matchMedia(WIDE_INFO_QUERY).matches) setIsInfoOpen(false)
    window.setTimeout(focusComposer, 0)
  }

  const jumpTo = (focusId: string, anchor: string) => {
    setCentre("chat")
    setPhoneView("thread")
    if (!window.matchMedia(WIDE_INFO_QUERY).matches) setIsInfoOpen(false)
    setFocusedId(focusId)
    window.setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ block: "center", behavior: "smooth" }), 0)
    window.setTimeout(() => setFocusedId((current) => (current === focusId ? null : current)), FOCUS_MS)
  }
  const onJump = (executionId: string) => jumpTo(executionId, approvalAnchor(executionId))
  const onJumpException = (workItemId: string) => jumpTo(workItemId, exceptionAnchor(workItemId))

  const onSend = () => {
    const body = draft.trim()
    if (!body || isPending) return
    const handles = [...body.matchAll(/@([a-z0-9-]+)/g)].map((m) => m[1])
    const mentioned = agents.filter((a) => a.status === "active" && handles.includes(a.handle)).map((a) => a.name)
    // Written as a staff member: the Chatbot may be turning it into a customer reply.
    const chatbot = agents.find((a) => a.module === "chatbot" && a.status === "active")
    if (sendAsId && chatbot && !mentioned.includes(chatbot.name)) mentioned.push(chatbot.name)
    setError(null)
    setDraft("")
    const pendingId = `pending-${Date.now()}`
    setOutbox((current) => [...current, { id: pendingId, body, failed: false }])
    setTyping(mentioned.length ? mentioned.join(", ") : null)
    startTransition(async () => {
      const result = await sendTeamMessage(body, sendAsId).catch(() => ({ ok: false as const, error: t("sendFailed") }))
      setTyping(null)
      if (result.ok) {
        append(result.data)
        setOutbox((current) => current.filter((o) => o.id !== pendingId))
        router.refresh()
      } else {
        setOutbox((current) => current.map((o) => (o.id === pendingId ? { ...o, failed: true } : o)))
        setDraft((current) => current || body)
        setError(result.error)
      }
    })
  }

  const approvals = useMemo(() => [...pending, ...decided], [pending, decided])
  const cards = useMemo(() => [...exceptions, ...decidedExceptions], [exceptions, decidedExceptions])
  const items = useMemo(
    () => buildThread(messages, approvals, cards, nowIso, locale, { today: t("today"), yesterday: t("yesterday") }),
    [messages, approvals, cards, nowIso, locale, t],
  )
  const hasChatbot = agents.some((a) => a.module === "chatbot")
  const memberCount = agents.length + members.length + 1
  const firstApproval = pending.length ? [...pending].sort((a, b) => a.execution.created_at.localeCompare(b.execution.created_at))[0] : undefined
  const firstException = exceptions[0]
  // One number everywhere: governance counts approvals + exceptions once (an exception can also be an approval card).
  const waitingCount = pendingDecisions
  const onChip = () => {
    const approvalAt = firstApproval?.execution.created_at ?? ""
    if (firstApproval && (!firstException || approvalAt <= firstException.created_at)) onJump(firstApproval.execution.id)
    else if (firstException) onJumpException(firstException.id)
  }

  const thread = (
    <div ref={scrollRef} className={THREAD_SCROLL_CLASS_NAME} role="log" aria-label={t("conversationLabel")}>
      <div className={THREAD_BODY_CLASS_NAME}>
        <div className={PROMO_SLOT_CLASS_NAME}>
          <OfficePromoCard hasChatbot={hasChatbot} />
        </div>
        {items.length === 0 ? (
          <EmptyNotice message={t("emptyMessage")} description={t("emptyMessageHint")} />
        ) : (
          items.map((item) => {
            if (item.kind === "day") return <DaySeparator key={item.key} label={item.label} />
            if (item.kind === "exception") {
              return <ExceptionCard key={item.key} item={item.item} staff={staff} ownerName={userName} isFocused={focusedId === item.item.id} />
            }
            if (item.kind === "approval") {
              return (
                <ApprovalBubble
                  key={item.key}
                  approval={item.approval}
                  module={moduleOf(item.approval.execution.agent_id)}
                  isFocused={focusedId === item.approval.execution.id}
                />
              )
            }
            const { message } = item
            return (
              <MessageRow
                key={item.key}
                message={message}
                agent={message.agent_id ? (agentById.get(message.agent_id) ?? null) : null}
                isMine={message.author_kind === "human" && message.author_name === userName}
                leadName={message.lead_id ? (leadNames[message.lead_id] ?? null) : null}
                isContinuation={item.isContinuation}
                onReply={onMention}
              />
            )
          })
        )}
        {outbox.map((o) => (
          <PendingBubble key={o.id} body={o.body} failed={o.failed} />
        ))}
        <div className={TYPING_CLASS_NAME}>
          {typing ? <Text size="sm" tone="muted" live="polite">{t("typing", { name: typing })}</Text> : null}
        </div>
      </div>
    </div>
  )

  return (
    <div ref={rootRef} className={MESSENGER_CLASS_NAME} aria-label={t("messengerLabel")} role="region">
      <div className={phoneView === "list" ? LIST_COLUMN_CLASS_NAME : `${LIST_COLUMN_CLASS_NAME} ${PHONE_HIDDEN_CLASS_NAME}`}>
        <ConversationList
          groupName={workspaceName}
          messages={messages}
          agents={agents}
          customers={customers}
          pendingCount={waitingCount}
          nowIso={nowIso}
          onOpenGroup={() => {
            setCentre("chat")
            setPhoneView("thread")
          }}
        />
      </div>

      <div className={phoneView === "thread" ? THREAD_COLUMN_CLASS_NAME : `${THREAD_COLUMN_CLASS_NAME} ${PHONE_HIDDEN_CLASS_NAME}`}>
        <header className={COLUMN_HEAD_CLASS_NAME}>
          <div className={`${PHONE_ONLY_CLASS_NAME} ${BACK_GLYPH_CLASS_NAME}`}>
            <IconButton source={nivoIconSource("next", "leading")} label={t("back")} onPress={() => (centre === "tasks" ? setCentre("chat") : setPhoneView("list"))} />
          </div>
          <span className={HEAD_AVATAR_CLASS_NAME} aria-hidden="true">
            <Icon source={nivoIconSource("community", "leading")} usage="leading" />
          </span>
          <div className={HEAD_TEXT_CLASS_NAME}>
            <Heading level={1}>{centre === "tasks" ? t("tasksTitle") : t("title")}</Heading>
            {centre === "tasks" ? null : (
              <Text size="sm" tone="muted" overflow="truncate">
                {memberCount === 1 ? t("memberCountOne") : t("memberCount", { n: memberCount })}
              </Text>
            )}
          </div>
          <div className={HEAD_ACTIONS_CLASS_NAME}>
            {centre === "tasks" ? (
              <div className={WIDE_ONLY_CLASS_NAME}>
                <Button variant="ghost" size="sm" onPress={() => setCentre("chat")}>{t("tasksBack")}</Button>
              </div>
            ) : firstApproval || firstException ? (
              <Button variant="outline" size="sm" onPress={onChip}>
                <span className={WIDE_ONLY_CLASS_NAME}>{t("needsApprovalChip", { n: waitingCount })}</span>
                <span className={NARROW_ONLY_CLASS_NAME}>{t("needsApprovalShort", { n: waitingCount })}</span>
              </Button>
            ) : null}
            <IconButton source={nivoIconSource("sidebar", "leading")} label={isInfoOpen ? t("infoClose") : t("infoOpen")} isActive={isInfoOpen} onPress={() => setIsInfoOpen((open) => !open)} />
          </div>
        </header>
        {centre === "tasks" ? (
          <div className={TASKS_SCROLL_CLASS_NAME}>
            <TasksPanel items={tasks} />
          </div>
        ) : (
          <>
            {thread}
            <Composer
              draft={draft}
              agents={agents}
              staff={members}
              userName={userName}
              avatarUrl={avatarUrl}
              sendAs={sendAsId}
              onSendAsChange={setSendAs}
              chatbotHandle={agents.find((a) => a.module === "chatbot")?.handle ?? null}
              error={error}
              isPending={isPending}
              hostRef={composerHostRef}
              onDraftChange={setDraft}
              onSend={onSend}
            />
          </>
        )}
      </div>

      {isInfoOpen ? (
        <aside className={INFO_COLUMN_CLASS_NAME} aria-label={t("infoTitle")}>
          <InfoPanel
            userName={userName}
            avatarUrl={avatarUrl}
            agents={agents}
            staff={members}
            pending={pending}
            exceptions={exceptions}
            tasks={tasks}
            moduleOf={moduleOf}
            onJump={onJump}
            onJumpException={onJumpException}
            onMention={onMention}
            onOpenTasks={() => {
              setCentre("tasks")
              setPhoneView("thread")
              if (!window.matchMedia(WIDE_INFO_QUERY).matches) setIsInfoOpen(false)
            }}
            onClose={() => setIsInfoOpen(false)}
          />
        </aside>
      ) : null}
    </div>
  )
}

