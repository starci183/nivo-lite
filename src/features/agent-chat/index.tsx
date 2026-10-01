"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { listAgentMessages, listConversations, sendAgentMessage, startConversation } from "@/lib/actions";
import { useLocale, useT } from "@/i18n/client";
import { intlLocale, TIME_ZONE, type Locale } from "@/i18n/core";
import { agentChat } from "@/i18n/dict/agentChat";
import { sendAsHuman, takeOverConversation } from "@/lib/flow-actions";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { AgentConversation, AgentMessage } from "@/lib/types";
import { WelcomeBanner } from "@/features/promo-ads/WelcomeBanner";
import { AgentChatBase, type AgentChatTab } from "./component";

/** Plain agent data handed over by the server page. */
export type AgentChatProps = {
  readonly agent: { readonly id: string; readonly module?: string; readonly name: string; readonly handle: string; readonly role: string; readonly isActive: boolean; readonly hasCustomerChannel: boolean };
  readonly initialTab: AgentChatTab;
  readonly initialConversationId: string | null;
  /** True only for a Founding 50 member arriving with ?welcome=1. */
  readonly showWelcome?: boolean;
};

const OPTIMISTIC_PREFIX = "optimistic-";

const timeLabel = (iso: string, locale: Locale): string =>
  new Intl.DateTimeFormat(intlLocale(locale), { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE }).format(new Date(iso));

const mergeMessage = (current: ReadonlyArray<AgentMessage>, incoming: AgentMessage): Array<AgentMessage> => {
  if (current.some((item) => item.id === incoming.id)) return [...current];
  const withoutEcho = incoming.role === "user"
    ? current.filter((item) => !(item.id.startsWith(OPTIMISTIC_PREFIX) && item.body === incoming.body))
    : current;
  return [...withoutEcho, incoming];
};

/** Connected agent chat: loads conversations, sends messages, follows realtime inserts. */
export const AgentChat = (props: AgentChatProps) => {
  const { agent } = props;
  const router = useRouter();
  const t = useT(agentChat);
  const locale = useLocale();
  const [tab, setTab] = useState<AgentChatTab>(props.agent.hasCustomerChannel ? props.initialTab : "test");
  const [conversations, setConversations] = useState<ReadonlyArray<AgentConversation>>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [selected, setSelected] = useState<Record<AgentChatTab, string | null>>({
    test: props.initialTab === "test" ? props.initialConversationId : null,
    customer: props.initialTab === "customer" ? props.initialConversationId : null,
  });
  const [messages, setMessages] = useState<ReadonlyArray<AgentMessage>>([]);
  const [draft, setDraft] = useState("");
  const [visitorName, setVisitorName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSending, startSending] = useTransition();
  const [isStarting, startStarting] = useTransition();
  const [isTakingOver, startTakingOver] = useTransition();
  const [takenOver, setTakenOver] = useState<Record<string, boolean>>({});

  const selectedId = selected[tab];
  const selectedConversation = conversations.find((item) => item.id === selectedId) ?? null;
  const handledBy = (item: AgentConversation | null): string | null => (item === null ? null : ((item as AgentConversation & { handled_by?: string | null }).handled_by ?? null));
  const isTakenOver = selectedId !== null && tab === "customer" && (takenOver[selectedId] ?? handledBy(selectedConversation) !== null);

  const reloadConversations = useCallback(async () => {
    setConversations(await listConversations(agent.id));
    setIsLoadingList(false);
  }, [agent.id]);

  useEffect(() => {
    void reloadConversations();
    // Customers on real channels (Telegram) open conversations on their own: show them as they arrive.
    const client = supabaseBrowser();
    const channel = client
      .channel(`agent-conversations-${agent.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_conversations", filter: `agent_id=eq.${agent.id}` }, () => {
        void reloadConversations();
      })
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [reloadConversations, agent.id]);

  useEffect(() => {
    setError(null);
    if (!selectedId) {
      setMessages([]);
      return undefined;
    }
    let cancelled = false;
    void listAgentMessages(selectedId).then((rows) => {
      if (!cancelled) setMessages(rows);
    });
    const client = supabaseBrowser();
    const channel = client
      .channel(`agent-messages-${selectedId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "agent_messages", filter: `conversation_id=eq.${selectedId}` }, (payload) => {
        setMessages((current) => mergeMessage(current, payload.new as AgentMessage));
      })
      .subscribe();
    return () => {
      cancelled = true;
      void client.removeChannel(channel);
    };
  }, [selectedId]);

  const openConversation = useCallback(async (kind: AgentChatTab): Promise<string | null> => {
    const outcome = await startConversation(agent.id, kind, kind === "customer" && visitorName.trim() ? visitorName.trim() : undefined);
    if (!outcome.ok) {
      setError(outcome.error);
      return null;
    }
    setSelected((current) => ({ ...current, [kind]: outcome.data.id }));
    setVisitorName("");
    await reloadConversations();
    return outcome.data.id;
  }, [agent.id, reloadConversations, visitorName]);

  const onStart = () => {
    setError(null);
    startStarting(async () => {
      await openConversation(tab);
    });
  };

  const onSend = (prompt?: string) => {
    const body = (prompt ?? draft).trim();
    if (!body) return;
    setError(null);
    if (prompt === undefined) setDraft("");
    startSending(async () => {
      const conversationId = selectedId ?? (await openConversation(tab));
      if (!conversationId) {
        if (prompt === undefined) setDraft(body);
        return;
      }
      setMessages((current) => [
        ...current,
        { id: `${OPTIMISTIC_PREFIX}${Date.now()}`, workspace_id: "", conversation_id: conversationId, role: "user", body, created_at: new Date().toISOString() },
      ]);
      const outcome = isTakenOver ? await sendAsHuman(conversationId, body) : await sendAgentMessage(conversationId, body);
      if (!outcome.ok) {
        setError(outcome.error);
        setMessages((current) => current.filter((item) => !item.id.startsWith(OPTIMISTIC_PREFIX)));
        if (prompt === undefined) setDraft(body);
        return;
      }
      setMessages(await listAgentMessages(conversationId));
      if ("capturedLeadId" in outcome.data && outcome.data.capturedLeadId) await reloadConversations();
    });
  };

  const onToggleTakeover = () => {
    if (selectedId === null) return;
    const conversationId = selectedId;
    const take = !isTakenOver;
    setError(null);
    startTakingOver(async () => {
      const outcome = await takeOverConversation(conversationId, take);
      if (!outcome.ok) {
        setError(outcome.error);
        return;
      }
      setTakenOver((current) => ({ ...current, [conversationId]: outcome.data.handled_by !== null }));
      await reloadConversations();
    });
  };

  const onTab = (next: AgentChatTab) => {
    setTab(next);
    router.replace(`/modules/${agent.id}/chat?tab=${next}`, { scroll: false });
  };

  const rows = useMemo(
    () => conversations
      .map((item) => ({
        id: item.id,
        kind: item.kind,
        hasLead: item.lead_id !== null,
        title: item.kind === "customer" ? (item.visitor_name ?? t("websiteVisitor")) : t("testConversation"),
        kindLabel: item.kind === "customer" ? (item.channel === "telegram" ? `${t("kindCustomer")} · Telegram` : t("kindCustomer")) : t("kindTest"),
        timeLabel: timeLabel(item.created_at, locale),
        isSelected: item.id === selected[item.kind],
      })),
    [conversations, selected, t, locale],
  );

  const leadId = tab === "customer" ? (selectedConversation?.lead_id ?? null) : null;

  return (
    <AgentChatBase
      banner={props.showWelcome === true ? <WelcomeBanner agentId={agent.id} /> : undefined}
      agentModule={agent.module}
      setupHref={`/modules/${agent.id}`}
      agentName={agent.name}
      agentHandle={agent.handle}
      agentRole={agent.role}
      isAgentActive={agent.isActive}
      hasCustomerChannel={agent.hasCustomerChannel}
      tab={tab}
      conversations={rows}
      messages={messages.map((item) => ({ id: item.id, role: item.role, body: item.body, timeLabel: timeLabel(item.created_at, locale) }))}
      hasSelection={selectedId !== null}
      isLoadingList={isLoadingList}
      isSending={isSending}
      isStarting={isStarting}
      draft={draft}
      visitorName={visitorName}
      error={error}
      leadId={leadId}
      isTakenOver={isTakenOver}
      isTakingOver={isTakingOver}
      onToggleTakeover={onToggleTakeover}
      onBack={() => router.push("/modules")}
      onTab={onTab}
      onDraft={setDraft}
      onVisitorName={setVisitorName}
      onSend={onSend}
      onStart={onStart}
      onSelect={(conversationId, kind) => {
        setSelected((current) => ({ ...current, [kind]: conversationId }));
        onTab(kind);
      }}
      onOpenLead={(id) => router.push(`/leads/${id}`)}
    />
  );
};
