"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Badge, Button, EmptyNotice, Meter, SurfaceCard, Text, Textarea } from "@starci/grammar/common";
import { useLocale, useT } from "@/i18n/client";
import { intlLocale, TIME_ZONE } from "@/i18n/core";
import { moduleSetup } from "@/i18n/dict/moduleSetup";
import { applySetup, sendSetupMessage, setGate } from "@/lib/module-actions";
import {
  MODULE_GATES, allGatesConfirmed, gateEntry, gateHint, gateLabel, snapshotOf,
  type ContextVersion, type GateStatus, type Installation, type SetupMessage, type SetupRevision, type SetupSession,
} from "@/lib/modules-shared";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { moduleArt } from "@/features/modules-core/meta";
import { SetupKnowledge } from "./SetupKnowledge";
import * as c from "./classNames";

type SetupScreenProps = {
  readonly installation: Installation;
  readonly initialSession: SetupSession;
  readonly initialRevisions: ReadonlyArray<SetupRevision>;
  readonly initialMessages: ReadonlyArray<SetupMessage>;
  readonly initialVersions: ReadonlyArray<ContextVersion>;
};

const GATE_TONE: Record<GateStatus, "neutral" | "warning" | "success"> = { missing: "neutral", proposed: "warning", confirmed: "success" };

const byTime = (a: SetupMessage, b: SetupMessage) => a.createdAt.localeCompare(b.createdAt);
const mergeMessages = (current: ReadonlyArray<SetupMessage>, incoming: ReadonlyArray<SetupMessage>): Array<SetupMessage> => {
  const map = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) map.set(m.id, m);
  return [...map.values()].sort(byTime);
};

/** The Setup tab: private chat with NIVO on the left, the draft, gate checklist and versions on the right. */
export const SetupScreen = ({ installation, initialSession, initialRevisions, initialMessages, initialVersions }: SetupScreenProps) => {
  const t = useT(moduleSetup);
  const locale = useLocale();
  const router = useRouter();
  const [session, setSession] = useState(initialSession);
  const [revisions, setRevisions] = useState<ReadonlyArray<SetupRevision>>(initialRevisions);
  const [messages, setMessages] = useState<Array<SetupMessage>>([...initialMessages]);
  const [versions, setVersions] = useState<ReadonlyArray<ContextVersion>>(initialVersions);
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

  const gates = MODULE_GATES[installation.moduleKey];
  const art = moduleArt(installation.moduleKey);

  // A new draft session (after an apply) arrives through the server: follow it.
  useEffect(() => { setSession(initialSession); setRevisions(initialRevisions); setMessages([...initialMessages]); setVersions(initialVersions); }, [initialSession, initialRevisions, initialMessages, initialVersions]);

  // Realtime: NIVO's replies and the owner's other tabs.
  useEffect(() => {
    const client = supabaseBrowser();
    const channel = client
      .channel(`module-setup-${session.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "module_setup_messages", filter: `setup_session_id=eq.${session.id}` }, (payload) => {
        const r = payload.new as { id: string; setup_session_id: string; role: "user" | "assistant"; author: string; body: string; created_at: string };
        setMessages((cur) => mergeMessages(cur, [{ id: r.id, setupSessionId: r.setup_session_id, role: r.role, author: r.author, body: r.body, createdAt: r.created_at }]));
      })
      .subscribe();
    return () => { void client.removeChannel(channel); };
  }, [session.id]);

  // Open at the newest message (the thread scrolls, not the page).
  useLayoutEffect(() => { const el = threadRef.current; if (el) el.scrollTop = el.scrollHeight; }, [messages.length, isSending, revisions.length]);

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
    });
  }, [text, isSending, session.id]);

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
    startApplying(async () => {
      const result = await applySetup(installation.id);
      if (!result.ok) { setApplyMessage({ ok: false, text: result.error }); return; }
      setApplyMessage({ ok: true, text: t("applied", { version: result.data.version }) });
      router.refresh();
    });
  };

  const confirmedCount = gates.filter((g) => gateEntry(session.gateEvidence, g.key).status === "confirmed").length;
  const ready = allGatesConfirmed(installation.moduleKey, session.gateEvidence);
  const activeVersion = versions.find((v) => v.id === installation.activeContextVersionId) ?? null;
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
  const stamp = (iso: string) => new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium", timeStyle: "short", timeZone: TIME_ZONE }).format(new Date(iso));

  return (
    <div className={c.GRID_CLASS_NAME}>
      <section className={c.CHAT_CLASS_NAME} aria-label={t("chatTitle")}>
        <div className={c.CHAT_HEAD_CLASS_NAME}>
          <img className={c.CHAT_HEAD_ART_CLASS_NAME} src="/images/promo/mascot-chat.png" alt="" />
          <div className="min-w-0">
            <Text weight="semibold">{t("chatTitle")}</Text>
            <Text size="xs" tone="muted">{t("chatPrivate")}</Text>
          </div>
        </div>
        <div ref={threadRef} className={c.THREAD_CLASS_NAME} aria-live="polite">
          {messages.length === 0 ? (
            <div className={c.EMPTY_CLASS_NAME}>
              <img className={c.EMPTY_ART_CLASS_NAME} src={art} alt="" />
              <Text weight="semibold">{t("emptyTitle")}</Text>
              <Text size="sm" tone="muted">{t("emptyBody")}</Text>
            </div>
          ) : null}
          {groups.map((g) => (
            <Fragment key={g.id}>
              {g.messages.map((m) => (
                <div key={m.id} className={m.role === "user" ? c.ROW_USER_CLASS_NAME : c.ROW_CLASS_NAME}>
                  <div className={m.role === "user" ? c.BUBBLE_USER_CLASS_NAME : c.BUBBLE_CLASS_NAME}>
                    <span className={c.WHO_CLASS_NAME}>{m.role === "user" ? m.author || t("you") : t("nivo")}</span>
                    {m.body}
                  </div>
                </div>
              ))}
              {g.divider !== null ? <div className={c.DIVIDER_CLASS_NAME} role="separator"><span className={c.DIVIDER_LABEL_CLASS_NAME}>{g.divider}</span></div> : null}
            </Fragment>
          ))}
          {isSending ? (
            <div className={c.ROW_CLASS_NAME}>
              <div className={c.BUBBLE_CLASS_NAME}><Text size="sm" tone="muted">{t("sending")}</Text></div>
            </div>
          ) : null}
        </div>
        {chatError !== undefined ? <div className={c.ERROR_CLASS_NAME}><Alert title={t("chatError")} description={chatError} tone="negative" /></div> : null}
        <form
          className={c.COMPOSER_CLASS_NAME}
          onSubmit={(e) => { e.preventDefault(); onSend(); }}
        >
          <textarea
            className={c.COMPOSER_INPUT_CLASS_NAME}
            aria-label={t("chatPlaceholder")}
            placeholder={t("chatPlaceholder")}
            rows={2}
            maxLength={4000}
            value={text}
            disabled={isSending}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); onSend(); } }}
          />
          <Button variant="primary" isPending={isSending} isDisabled={text.trim().length === 0} onPress={() => onSend()}>{t("send")}</Button>
        </form>
      </section>

      <div className={c.SIDE_CLASS_NAME}>
        <SurfaceCard label={t("draftTitle")} headingLevel={2}>
          <div className={c.STACK_CLASS_NAME}>
            {session.draft.summary ? <Text size="sm">{session.draft.summary}</Text> : <Text size="sm" tone="muted">{t("draftEmpty")}</Text>}
            {session.draft.facts.length > 0 ? (
              <>
                <Text size="xs" tone="muted" weight="semibold">{t("factsTitle")}</Text>
                <ul className={c.FACTS_CLASS_NAME}>
                  {session.draft.facts.map((f) => (
                    <li key={f.key} className={c.FACT_CLASS_NAME}>
                      <span className={c.FACT_DOT_CLASS_NAME} aria-hidden="true" />
                      <span>{f.text}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        </SurfaceCard>

        <SurfaceCard label={t("gatesTitle")} headingLevel={2}>
          <div className={c.STACK_CLASS_NAME}>
            <Meter label={t("gatesProgress", { done: confirmedCount, total: gates.length })} value={confirmedCount} minValue={0} maxValue={gates.length} />
            {gateError !== undefined ? <Alert title={t("applyFailed")} description={gateError} tone="negative" /> : null}
            <div className={c.GATE_LIST_CLASS_NAME}>
              {gates.map((g) => {
                const entry = gateEntry(session.gateEvidence, g.key);
                const isEditing = editing === g.key;
                return (
                  <div key={g.key} className={c.GATE_CLASS_NAME}>
                    <div className={c.GATE_HEAD_CLASS_NAME}>
                      <Text weight="semibold" size="sm">{gateLabel(g, locale)}</Text>
                      <Badge isDot tone={GATE_TONE[entry.status]}>{t(`gate_${entry.status}`)}</Badge>
                    </div>
                    {isEditing ? (
                      <>
                        <Textarea name={`gate-${g.key}`} label={gateLabel(g, locale)} isLabelHidden description={gateHint(g, locale)} rows={3} maxLength={800} placeholder={t("evidencePlaceholder")} value={editText} onValueChange={setEditText} />
                        <div className={c.GATE_ACTIONS_CLASS_NAME}>
                          <Button variant="primary" size="sm" isPending={isGating} isDisabled={editText.trim().length === 0} onPress={() => onGate(g.key, "edit", editText)}>{t("editSave")}</Button>
                          <Button variant="ghost" size="sm" onPress={() => setEditing(null)}>{t("editCancel")}</Button>
                        </div>
                      </>
                    ) : (
                      <>
                        {entry.evidence ? <div className={c.EVIDENCE_CLASS_NAME}>{entry.evidence}</div> : <Text size="sm" tone="muted">{gateHint(g, locale)}</Text>}
                        <div className={c.GATE_ACTIONS_CLASS_NAME}>
                          {entry.status === "proposed" ? <Button variant="secondary" size="sm" isPending={isGating} onPress={() => onGate(g.key, "confirm")}>{t("confirm")}</Button> : null}
                          {entry.status === "confirmed" ? <Button variant="ghost" size="sm" isPending={isGating} onPress={() => onGate(g.key, "reopen")}>{t("unconfirm")}</Button> : null}
                          <Button variant="ghost" size="sm" onPress={() => { setEditing(g.key); setEditText(entry.evidence); }}>{t("edit")}</Button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <div className={c.STACK_CLASS_NAME}>
              <Button variant="primary" isPending={isApplying} isDisabled={!ready || unchanged} onPress={onApply}>{isApplying ? t("applying") : t("apply")}</Button>
              <Text size="xs" tone="muted">{!ready ? t("applyHint") : unchanged ? t("applyUnchanged") : t("applyHint")}</Text>
              {applyMessage !== undefined ? <Alert title={applyMessage.ok ? t("apply") : t("applyFailed")} description={applyMessage.text} tone={applyMessage.ok ? "affirmative" : "negative"} /> : null}
            </div>
          </div>
        </SurfaceCard>

        <SetupKnowledge installationId={installation.id} moduleKey={installation.moduleKey} refreshKey={`${session.revision}:${session.draft.facts.length}:${versions.length}`} onApplied={() => router.refresh()} />

        <SurfaceCard label={t("versionsTitle")} headingLevel={2}>
          {versions.length === 0 ? (
            <Text size="sm" tone="muted">{t("versionsEmpty")}</Text>
          ) : (
            <div className={c.VERSION_LIST_CLASS_NAME}>
              {versions.map((v) => (
                <div key={v.id} className={c.VERSION_ROW_CLASS_NAME}>
                  <div className="min-w-0">
                    <Text weight="semibold" size="sm">{t("versionLine", { version: v.version })}</Text>
                    <Text size="xs" tone="muted">{t("versionBy", { who: v.appliedBy, when: stamp(v.appliedAt) })} · {t("versionFacts", { count: v.snapshot.facts.length })}</Text>
                  </div>
                  {v.id === installation.activeContextVersionId ? <Badge isDot tone="success">{t("inUse")}</Badge> : null}
                </div>
              ))}
            </div>
          )}
        </SurfaceCard>
      </div>
    </div>
  );
};
