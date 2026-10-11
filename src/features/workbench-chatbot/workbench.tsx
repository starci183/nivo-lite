"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Alert, DescriptionList, EmptyNotice, FillViewport, SurfaceCard } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { workbenchChatbot } from "@/i18n/dict/workbenchChatbot";
import { supabaseBrowser } from "@/lib/supabase/browser";
import {
  answerEscalation, handBack, loadChatbotOverview, loadChatbotThread, replyAsMember, takeOver,
  type WbMetrics, type WbOverview, type WbThread,
} from "@/lib/workbench-chatbot";
import {
  CENTER_CLASS_NAME, INBOX_CLASS_NAME, LIST_PANE_OPEN_CLASS_NAME, LIST_PANE_WIDE_ONLY_CLASS_NAME, SIDE_PANE_DOCKED_ONLY_CLASS_NAME, SIDE_PANE_OPEN_CLASS_NAME,
  THREAD_PANE_OPEN_CLASS_NAME, THREAD_PANE_WIDE_ONLY_CLASS_NAME, WORKBENCH_CLASS_NAME,
} from "./classNames";
import { ConversationPane, matchesFilter, type InboxFilter } from "./list";
import { SidePane } from "./side";
import { ThreadPane } from "./thread";

export type ChatbotWorkbenchProps = {
  readonly initial: WbOverview;
  readonly initialThread: WbThread | null;
  readonly userName: string;
};

const REFRESH_DEBOUNCE_MS = 600;

const contains = (text: string, query: string) => text.toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi"));

type Translate = ReturnType<typeof useT<typeof workbenchChatbot.en>>;

const responseLabel = (m: WbMetrics, t: Translate): { value: string; sub: string } => {
  if (m.avgFirstResponseMin === null) return { value: "—", sub: t("metricResponseNone") };
  const value = m.avgFirstResponseMin < 1 ? t("seconds", { n: Math.max(1, Math.round(m.avgFirstResponseMin * 60)) }) : t("minutes", { n: Math.round(m.avgFirstResponseMin * 10) / 10 });
  return { value, sub: t("metricResponseSub", { n: m.sample }) };
};

/** The Chatbot workbench: metrics, then conversation list, thread and customer panel with realtime updates. */
export const ChatbotWorkbench = ({ initial, initialThread, userName }: ChatbotWorkbenchProps) => {
  const t = useT(workbenchChatbot);

  const [overview, setOverview] = useState<WbOverview>(initial);
  const [selectedId, setSelectedId] = useState<string | null>(initialThread?.conversation.id ?? null);
  const [thread, setThread] = useState<WbThread | null>(initialThread);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [query, setQuery] = useState("");
  const [pane, setPane] = useState<"list" | "thread">(initialThread ? "thread" : "list");
  const [infoOpen, setInfoOpen] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isBusy, startBusy] = useTransition();
  const selectedRef = useRef<string | null>(selectedId);
  selectedRef.current = selectedId;

  const refresh = useCallback(async () => {
    const id = selectedRef.current;
    try {
      const [next, nextThread] = await Promise.all([loadChatbotOverview(), id ? loadChatbotThread(id) : Promise.resolve(null)]);
      setOverview(next);
      if (id && selectedRef.current === id) setThread(nextThread);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, []);

  // Realtime: any message, conversation or waiting item of this workspace refreshes the list and the open thread.
  const { workspaceId } = overview;
  useEffect(() => {
    const client = supabaseBrowser();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void refresh(), REFRESH_DEBOUNCE_MS);
    };
    const filterSql = `workspace_id=eq.${workspaceId}`;
    const channel = client.channel(`chatbot-workbench-${workspaceId}`);
    for (const table of ["agent_messages", "agent_conversations", "work_items"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table, filter: filterSql }, schedule);
    }
    channel.subscribe();
    return () => {
      clearTimeout(timer);
      void client.removeChannel(channel);
    };
  }, [workspaceId, refresh]);

  const select = (id: string) => {
    setSelectedId(id);
    selectedRef.current = id;
    setPane("thread");
    setActionError(null);
    setIsLoadingThread(true);
    void loadChatbotThread(id)
      .then((next) => {
        if (selectedRef.current === id) setThread(next);
      })
      .catch(() => setLoadFailed(true))
      .finally(() => setIsLoadingThread(false));
  };

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startBusy(async () => {
      setActionError(null);
      const res = await fn();
      if (!res.ok) setActionError(res.error ?? t("loadError"));
      await refresh();
    });

  const q = query.trim();
  const visible = useMemo(
    () => overview.conversations.filter((c) => matchesFilter(c, filter, overview.nowIso) && (!q || contains(c.name, q) || contains(c.lastText, q))),
    [overview, filter, q],
  );
  const response = responseLabel(overview.metrics, t);

  return (
    <div className={WORKBENCH_CLASS_NAME}>
      <SurfaceCard>
        <DescriptionList
          layout="stat-strip"
          isDivided
          items={[
            { id: "today", term: t("metricToday"), description: String(overview.metrics.today), meta: t("metricTodaySub") },
            { id: "waiting", term: t("metricWaiting"), description: String(overview.metrics.waiting), meta: t("metricWaitingSub") },
            { id: "response", term: t("metricResponse"), description: response.value, meta: response.sub },
          ]}
        />
      </SurfaceCard>

      {loadFailed ? (
        <Alert tone="negative" title={t("loadError")} action={{ label: t("reload"), onAction: () => void refresh() }} />
      ) : null}
      {actionError ? <Alert tone="negative" title={t("actionFailed")} description={actionError} /> : null}

      <FillViewport minHeight="md" bottomInset="page">
      <SurfaceCard ariaLabel={t("title")} composition="joined" height="fill">
      <div className={INBOX_CLASS_NAME}>
        <div className={pane === "list" ? LIST_PANE_OPEN_CLASS_NAME : LIST_PANE_WIDE_ONLY_CLASS_NAME}>
          <ConversationPane
            conversations={visible}
            total={overview.conversations.length}
            nowIso={overview.nowIso}
            selectedId={selectedId}
            filter={filter}
            query={query}
            onFilter={setFilter}
            onQuery={setQuery}
            onSelect={select}
          />
        </div>

        <div className={pane === "list" ? THREAD_PANE_WIDE_ONLY_CLASS_NAME : THREAD_PANE_OPEN_CLASS_NAME}>
          {selectedId === null ? (
            <div className={CENTER_CLASS_NAME}>
              <EmptyNotice message={t("pickTitle")} description={t("pickBody")} />
            </div>
          ) : (
            <ThreadPane
              thread={thread}
              isLoading={isLoadingThread}
              nowIso={overview.nowIso}
              userName={userName}
              infoOpen={infoOpen}
              onBack={() => setPane("list")}
              onToggleInfo={() => setInfoOpen((open) => !open)}
              onSend={async (text) => {
                const res = await replyAsMember(selectedId, text);
                await refresh();
                return res.ok ? null : res.error;
              }}
            />
          )}
        </div>

        {selectedId !== null ? (
          <aside className={infoOpen ? SIDE_PANE_OPEN_CLASS_NAME : SIDE_PANE_DOCKED_ONLY_CLASS_NAME} aria-label={t("customerTitle")}>
            <SidePane
              thread={thread}
              userName={userName}
              isBusy={isBusy}
              onClose={() => setInfoOpen(false)}
              onTakeOver={() => run(() => takeOver(selectedId))}
              onHandBack={() => run(() => handBack(selectedId))}
              onAnswer={async (text) => {
                const item = thread?.escalation;
                if (!item) return null;
                const res = await answerEscalation(item.workItemId, selectedId, text);
                await refresh();
                if (!res.ok) return res.error;
                return text !== null && !res.data.delivered && (thread?.conversation.channel === "telegram" || thread?.conversation.channel === "zalo") ? t("escalationSentFailed") : null;
              }}
            />
          </aside>
        ) : null}
      </div>
      </SurfaceCard>
      </FillViewport>
    </div>
  );
};
