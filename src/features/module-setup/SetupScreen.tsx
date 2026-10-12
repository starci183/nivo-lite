"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Badge, Button, ChatBubble, ChatBubbleSkeletons, ChatWorkspace, Divider, EmptyNotice, FillViewport, Form, Heading, List, ListItem, Meter, Skeleton, Spinner, SurfaceCard, SurfaceListCard, Text, Textarea } from "@starci/grammar/common";
import { useLocale, useT } from "@/i18n/client";
import { intlLocale, TIME_ZONE } from "@/i18n/core";
import { moduleSetup } from "@/i18n/dict/moduleSetup";
import { applySetup, decideSetupWrite, sendSetupMessage, setGate } from "@/lib/module-actions";
import type { SetupWrite, WriteDecision } from "@/lib/module-setup-writes";
import {
  MODULE_GATES, allGatesConfirmed, gateEntry, gateHint, gateLabel, snapshotOf,
  type ContextVersion, type GateStatus, type Installation, type ModuleKey, type SetupMessage, type SetupRevision, type SetupSession,
} from "@/lib/modules-shared";
import type { UnmetRequirement } from "@/lib/module-requirements";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { SetupKnowledge } from "./SetupKnowledge";
import { SetupWriteCard } from "./SetupWriteCard";
import * as c from "./classNames";

type SetupScreenProps = {
  /** Null while the setup loads (isLoading). */
  readonly installation: Installation | null;
  /** The module being set up: known from the route before the installation resolves. */
  readonly moduleKey: ModuleKey;
  readonly initialSession: SetupSession | null;
  readonly initialRevisions: ReadonlyArray<SetupRevision>;
  readonly initialMessages: ReadonlyArray<SetupMessage>;
  readonly initialVersions: ReadonlyArray<ContextVersion>;
  /** Requirements of the module (module.json requires) the workspace does not meet yet: a soft notice, never a block. */
  readonly unmetRequirements?: ReadonlyArray<UnmetRequirement>;
  /** The confirm cards of the chat: facts for the Second Brain and authority rules NIVO proposed from the owner's answers. */
  readonly initialWrites?: ReadonlyArray<SetupWrite>;
  /** STATE-8: the same tab while its data loads - card labels and gate names stay; the chat, draft, gate states and versions are skeletons. */
  readonly isLoading?: boolean;
};

/** The unresolved draft session of a loading screen: empty, never shown. */
const LOADING_SESSION: SetupSession = { id: "", installationId: "", revision: 0, status: "draft", draft: { summary: "", facts: [] }, gateEvidence: {}, createdAt: "" };

const GATE_TONE: Record<GateStatus, "neutral" | "warning" | "success"> = { missing: "neutral", proposed: "warning", confirmed: "success" };

const byTime = (a: SetupMessage, b: SetupMessage) => a.createdAt.localeCompare(b.createdAt);
const mergeMessages = (current: ReadonlyArray<SetupMessage>, incoming: ReadonlyArray<SetupMessage>): Array<SetupMessage> => {
  const map = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) map.set(m.id, m);
  return [...map.values()].sort(byTime);
};

/** The Setup tab: private chat with NIVO on the left, the draft, gate checklist and versions on the right. */
export const SetupScreen = ({ installation, moduleKey, initialSession, initialRevisions, initialMessages, initialVersions, unmetRequirements = [], initialWrites = [], isLoading = false }: SetupScreenProps) => {
  const t = useT(moduleSetup);
  const locale = useLocale();
  const router = useRouter();
  const [session, setSession] = useState<SetupSession>(initialSession ?? LOADING_SESSION);
  const [revisions, setRevisions] = useState<ReadonlyArray<SetupRevision>>(initialRevisions);
  const [messages, setMessages] = useState<Array<SetupMessage>>([...initialMessages]);
  const [versions, setVersions] = useState<ReadonlyArray<ContextVersion>>(initialVersions);
  const [writes, setWrites] = useState<Array<SetupWrite>>([...initialWrites]);
  const [text, setText] = useState("");
  const [chatError, setChatError] = useState<string | undefined>();
  const [isSending, startSending] = useTransition();
  const [gateError, setGateError] = useState<string | undefined>();
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [isGating, startGating] = useTransition();
  const [applyMessage, setApplyMessage] = useState<{ ok: boolean; text: string } | undefined>();
  const [isApplying, startApplying] = useTransition();
  const threadRef = useRef<HTMLDivElement | null>(null);

  const gates = MODULE_GATES[moduleKey];

  // A new draft session (after an apply) arrives through the server: follow it.
  useEffect(() => { setSession(initialSession ?? LOADING_SESSION); setRevisions(initialRevisions); setMessages([...initialMessages]); setVersions(initialVersions); setWrites([...initialWrites]); }, [initialSession, initialRevisions, initialMessages, initialVersions, initialWrites]);

  // Realtime: NIVO's replies and the owner's other tabs.
  useEffect(() => {
    if (isLoading) return undefined;
    const client = supabaseBrowser();
    const channel = client
      .channel(`module-setup-${session.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "module_setup_messages", filter: `setup_session_id=eq.${session.id}` }, (payload) => {
        const r = payload.new as { id: string; setup_session_id: string; role: "user" | "assistant"; author: string; body: string; created_at: string };
        setMessages((cur) => mergeMessages(cur, [{ id: r.id, setupSessionId: r.setup_session_id, role: r.role, author: r.author, body: r.body, createdAt: r.created_at }]));
      })
      .subscribe();
    return () => { void client.removeChannel(channel); };
  }, [session.id, isLoading]);

  // Open at the newest message (the thread scrolls, not the page). ChatWorkspace owns the scroll region; reach it from the thread inside it.
  useLayoutEffect(() => {
    const el = threadRef.current?.closest("[data-grammar-chat-workspace-scroll-owner]");
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, isSending, revisions.length]);

  const onSend = useCallback((override?: string) => {
    const body = (override ?? text).trim();
    if (!body || isSending) return;
    setChatError(undefined);
    setText("");
    startSending(async () => {
      const result = await sendSetupMessage(session.id, body);
      if (!result.ok) { setChatError(result.error); return; }
      setSession(result.data.session);
      setMessages((cur) => mergeMessages(cur, result.data.messages));
      setWrites(result.data.writes);
    });
  }, [text, isSending, session.id]);

  /** The owner confirms, edits or dismisses one card; the error (if any) shows on the card. */
  const onDecideWrite = useCallback(async (id: string, change: WriteDecision): Promise<string | undefined> => {
    const result = await decideSetupWrite(id, change);
    if (!result.ok) return result.error;
    setWrites((cur) => cur.map((w) => (w.id === id ? result.data : w)));
    return undefined;
  }, []);

  const onGate = (key: string, action: "confirm" | "reopen" | "edit", evidence?: string) => {
    setGateError(undefined);
    startGating(async () => {
      const result = await setGate(session.id, key, { action, evidence });
      if (!result.ok) { setGateError(result.error); return; }
      setSession(result.data);
      setEditing(null);
    });
  };

  const onApply = () => {
    setApplyMessage(undefined);
    if (installation === null) return;
    startApplying(async () => {
      const result = await applySetup(installation.id);
      if (!result.ok) { setApplyMessage({ ok: false, text: result.error }); return; }
      setApplyMessage({ ok: true, text: t("applied", { version: result.data.version }) });
      router.refresh();
    });
  };

  const confirmedCount = gates.filter((g) => gateEntry(session.gateEvidence, g.key).status === "confirmed").length;
  const ready = allGatesConfirmed(moduleKey, session.gateEvidence);
  const activeVersion = versions.find((v) => v.id === installation?.activeContextVersionId) ?? null;
  const unchanged = useMemo(
    () => activeVersion !== null && JSON.stringify(activeVersion.snapshot) === JSON.stringify(snapshotOf(session.draft, session.gateEvidence)),
    [activeVersion, session.draft, session.gateEvidence],
  );
  const dayStamp = (iso: string) => new Intl.DateTimeFormat(intlLocale(locale), { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TIME_ZONE }).format(new Date(iso));
  // The whole history, one group per revision (oldest first); an applied revision ends with its divider, the current draft continues below.
  const groups = useMemo(() => {
    const out: Array<{ id: string; messages: Array<SetupMessage>; divider: string | null }> = [];
    for (const r of revisions) {
      const own = messages.filter((m) => m.setupSessionId === r.id);
      if (r.id === session.id) { out.push({ id: r.id, messages: own, divider: null }); continue; }
      if (own.length === 0) continue;
      const v = versions.find((x) => x.version === r.revision);
      out.push({ id: r.id, messages: own, divider: v ? t("revisionApplied", { version: r.revision, when: dayStamp(v.appliedAt), who: v.appliedBy }) : t("revisionAppliedPlain", { version: r.revision }) });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revisions, messages, versions, session.id, locale, t]);
  // The cards of an owner's message sit under NIVO's reply to it (the next assistant message).
  const cardsAfter = useMemo(() => {
    const out = new Map<string, Array<SetupWrite>>();
    const sorted = [...messages].sort(byTime);
    sorted.forEach((m, i) => {
      if (m.role !== "user") return;
      const mine = writes.filter((w) => w.sourceMessageId === m.id);
      if (mine.length === 0) return;
      const reply = sorted.slice(i + 1).find((x) => x.role === "assistant");
      const at = reply ?? m;
      out.set(at.id, [...(out.get(at.id) ?? []), ...mine]);
    });
    return out;
  }, [messages, writes]);
  const stamp = (iso: string) => new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium", timeStyle: "short", timeZone: TIME_ZONE }).format(new Date(iso));

  return (
    <div className={c.GRID_CLASS_NAME}>
      <FillViewport minHeight="md" bottomInset="page">
        <SurfaceCard ariaLabel={t("chatTitle")} composition="joined" height="fill">
          <ChatWorkspace
            label={t("chatTitle")}
            conversationLabel={t("chatTitle")}
            header={
              <div className={c.CHAT_BAND_CLASS_NAME}>
                <Heading level={2}>{t("chatTitle")}</Heading>
                <Text size="xs" tone="muted">{t("chatPrivate")}</Text>
              </div>
            }
            conversation={
              <div ref={threadRef} className={c.THREAD_CLASS_NAME} aria-live="polite">
                {isLoading ? <ChatBubbleSkeletons count={3} /> : null}
                {!isLoading && messages.length === 0 ? <EmptyNotice message={t("emptyTitle")} description={t("emptyBody")} /> : null}
                {groups.map((g) => (
                  <Fragment key={g.id}>
                    {g.messages.map((m) => {
                      const cards = cardsAfter.get(m.id) ?? [];
                      return (
                        <ChatBubble
                          key={m.id} side={m.role === "user" ? "outgoing" : "incoming"} author={m.role === "user" ? m.author || t("you") : t("nivo")}
                          footer={cards.length > 0 ? <div className={c.WRITES_CLASS_NAME}>{cards.map((w) => <SetupWriteCard key={w.id} write={w} onDecide={onDecideWrite} />)}</div> : undefined}
                        >
                          {m.body}
                        </ChatBubble>
                      );
                    })}
                    {g.divider !== null ? <Divider label={g.divider} /> : null}
                  </Fragment>
                ))}
                {isSending ? (
                  <div className={c.ROW_CLASS_NAME}>
                    <Text size="sm" tone="muted" startContent={<Spinner size="sm" label={t("sending")} />}>{t("sending")}</Text>
                  </div>
                ) : null}
              </div>
            }
            composer={
              <Form label={t("chatTitle")} onSubmit={(_, e) => { e.preventDefault(); onSend(); }}>
                <div className={c.COMPOSER_CLASS_NAME}>
                  {chatError !== undefined ? <Alert title={t("chatError")} description={chatError} tone="negative" /> : null}
                  <div className={c.COMPOSER_ROW_CLASS_NAME}>
                    <div className={c.COMPOSER_FIELD_CLASS_NAME}>
                      <Textarea
                        id="setup-composer" name="message" label={t("chatPlaceholder")} isLabelHidden placeholder={t("chatPlaceholder")}
                        rows={2} maxLength={4000} value={text} isSkeleton={isLoading} isDisabled={isSending} onValueChange={setText} onSubmitShortcut={() => onSend()}
                      />
                    </div>
                    <Button variant="primary" isPending={isSending} isDisabled={isLoading || text.trim().length === 0} onPress={() => onSend()}>{t("send")}</Button>
                  </div>
                </div>
              </Form>
            }
          />
        </SurfaceCard>
      </FillViewport>

      <div className={c.SIDE_CLASS_NAME}>
        {unmetRequirements.length > 0 ? (
          <Alert
            title={t("requirementsTitle")}
            description={`${t("requirementsBody")} ${unmetRequirements.map((r) => (locale === "en" ? r.label.en : r.label.vi)).join("; ")}.`}
            tone="cautionary"
            appearance="soft"
            action={{ label: t("requirementsFix"), onAction: () => router.push(unmetRequirements[0].href) }}
          />
        ) : null}

        <SurfaceCard label={t("draftTitle")} headingLevel={2}>
          <div className={c.STACK_CLASS_NAME}>
            {isLoading ? <Skeleton shape="text" lines={3} /> : session.draft.summary ? <Text size="sm">{session.draft.summary}</Text> : <Text size="sm" tone="muted">{t("draftEmpty")}</Text>}
            {session.draft.facts.length > 0 ? (
              <>
                <Heading level={3}>{t("factsTitle")}</Heading>
                <List label={t("factsTitle")} className={c.FACTS_CLASS_NAME}>
                  {session.draft.facts.map((f) => (
                    <ListItem key={f.key}><Text size="sm">{f.text}</Text></ListItem>
                  ))}
                </List>
              </>
            ) : null}
          </div>
        </SurfaceCard>

        <SurfaceCard label={t("gatesTitle")} headingLevel={2}>
          <div className={c.STACK_CLASS_NAME}>
            <Meter label={t("gatesProgress", { done: confirmedCount, total: gates.length })} value={confirmedCount} minValue={0} maxValue={gates.length} isSkeleton={isLoading} />
            {gateError !== undefined ? <Alert title={t("applyFailed")} description={gateError} tone="negative" /> : null}
            <List label={t("gatesTitle")} className={c.GATE_LIST_CLASS_NAME}>
              {gates.map((g) => {
                const entry = gateEntry(session.gateEvidence, g.key);
                const isEditing = editing === g.key;
                return (
                  <ListItem key={g.key} className={c.GATE_CLASS_NAME}>
                    <div className={c.GATE_HEAD_CLASS_NAME}>
                      <Text weight="semibold" size="sm">{gateLabel(g, locale)}</Text>
                      <Badge isDot isSkeleton={isLoading} tone={GATE_TONE[entry.status]}>{t(`gate_${entry.status}`)}</Badge>
                    </div>
                    {isEditing ? (
                      <>
                        <Textarea variant="secondary" name={`gate-${g.key}`} label={gateLabel(g, locale)} isLabelHidden description={gateHint(g, locale)} rows={3} maxLength={800} placeholder={t("evidencePlaceholder")} value={editText} onValueChange={setEditText} />
                        <div className={c.GATE_ACTIONS_CLASS_NAME}>
                          <Button variant="primary" size="sm" isPending={isGating} isDisabled={editText.trim().length === 0} onPress={() => onGate(g.key, "edit", editText)}>{t("editSave")}</Button>
                          <Button variant="ghost" size="sm" onPress={() => setEditing(null)}>{t("editCancel")}</Button>
                        </div>
                      </>
                    ) : (
                      <>
                        {isLoading ? <Text size="sm" tone="muted">{gateHint(g, locale)}</Text> : entry.evidence ? <div className={c.EVIDENCE_CLASS_NAME}><Text size="sm">{entry.evidence}</Text></div> : <Text size="sm" tone="muted">{gateHint(g, locale)}</Text>}
                        {isLoading ? null : <div className={c.GATE_ACTIONS_CLASS_NAME}>
                          {entry.status === "proposed" ? <Button variant="secondary" size="sm" isPending={isGating} onPress={() => onGate(g.key, "confirm")}>{t("confirm")}</Button> : null}
                          {entry.status === "confirmed" ? <Button variant="ghost" size="sm" isPending={isGating} onPress={() => onGate(g.key, "reopen")}>{t("unconfirm")}</Button> : null}
                          <Button variant="ghost" size="sm" onPress={() => { setEditing(g.key); setEditText(entry.evidence); }}>{t("edit")}</Button>
                        </div>}
                      </>
                    )}
                  </ListItem>
                );
              })}
            </List>
            <div className={c.STACK_CLASS_NAME}>
              <Button variant="primary" isSkeleton={isLoading} isPending={isApplying} isDisabled={!ready || unchanged} onPress={onApply}>{isApplying ? t("applying") : t("apply")}</Button>
              <Text size="xs" tone="muted" isSkeleton={isLoading}>{!ready ? t("applyHint") : unchanged ? t("applyUnchanged") : t("applyHint")}</Text>
              {applyMessage !== undefined ? <Alert title={applyMessage.ok ? t("apply") : t("applyFailed")} description={applyMessage.text} tone={applyMessage.ok ? "affirmative" : "negative"} /> : null}
            </div>
          </div>
        </SurfaceCard>

        <SetupKnowledge isLoading={isLoading} installationId={installation?.id ?? ""} moduleKey={moduleKey} refreshKey={`${session.revision}:${session.draft.facts.length}:${versions.length}`} onApplied={() => router.refresh()} />

        <SurfaceListCard label={t("versionsTitle")} headingLevel={2} isLoading={isLoading} empty={<EmptyNotice message={t("versionsEmpty")} />}>
          {versions.length === 0 ? null : versions.map((v) => (
            <li key={v.id} className={c.VERSION_ROW_CLASS_NAME}>
              <div className={c.VERSION_COPY_CLASS_NAME}>
                <Text weight="semibold" size="sm">{t("versionLine", { version: v.version })}</Text>
                <Text size="xs" tone="muted">{t("versionBy", { who: v.appliedBy, when: stamp(v.appliedAt) })} · {t("versionFacts", { count: v.snapshot.facts.length })}</Text>
              </div>
              {v.id === installation?.activeContextVersionId ? <Badge isDot tone="success">{t("inUse")}</Badge> : null}
            </li>
          ))}
        </SurfaceListCard>
      </div>
    </div>
  );
};
