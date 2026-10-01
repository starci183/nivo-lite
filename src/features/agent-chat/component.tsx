"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AgentAvatar } from "@/components/avatar/PersonAvatar";
import { useT } from "@/i18n/client";
import { agentChat } from "@/i18n/dict/agentChat";
import { Alert, Badge, Button, Input, Tabs, Text } from "@starci/grammar/common";
import {
  BACK_CLASS_NAME, BUBBLE_CLASS_NAME, BUBBLE_STACK_CLASS_NAME, BUBBLE_STACK_USER_CLASS_NAME, BUBBLE_USER_CLASS_NAME, CHANNEL_BAR_CLASS_NAME, CHIPS_CLASS_NAME,
  COMPOSER_CLASS_NAME, COMPOSER_INPUT_CLASS_NAME, COMPOSER_ROW_CLASS_NAME, EMPTY_CHIPS_CLASS_NAME, EMPTY_CLASS_NAME, EMPTY_FIELD_CLASS_NAME,
  HEADER_ACTIONS_CLASS_NAME, HEADER_CLASS_NAME, HEADER_COPY_CLASS_NAME, LIST_COLUMN_CLASS_NAME, LIST_COLUMN_OPEN_CLASS_NAME, LIST_HEAD_CLASS_NAME,
  LIST_ITEM_ACTIVE_CLASS_NAME, LIST_ITEM_CLASS_NAME, LIST_ITEM_COPY_CLASS_NAME, LIST_SCROLL_CLASS_NAME, MAIN_CLASS_NAME, MESSAGE_ROW_CLASS_NAME,
  MESSAGE_ROW_USER_CLASS_NAME, NOTICE_LINK_CLASS_NAME, NOTICE_ROW_CLASS_NAME, PAGE_CLASS_NAME, STEP_LIST_CLASS_NAME, STEP_ROW_CLASS_NAME, THREAD_CLASS_NAME,
} from "./classNames";

/** Which channel the owner is looking at. */
export type AgentChatTab = "test" | "customer";

/** One resolved message row. */
export type AgentChatMessageView = {
  readonly id: string;
  readonly role: "user" | "agent" | "system";
  readonly body: string;
  readonly timeLabel: string;
};

/** One resolved row of the conversations list. */
export type AgentChatConversationView = {
  readonly id: string;
  readonly kind: AgentChatTab;
  readonly title: string;
  readonly kindLabel: string;
  readonly timeLabel: string;
  readonly isSelected: boolean;
  readonly hasLead: boolean;
};

/** Everything the presentational chat surface needs, already resolved. */
export type AgentChatBaseProps = {
  /** Optional campaign banner rendered at the top of the thread (post-purchase welcome). */
  readonly banner?: ReactNode;
  readonly agentModule?: string;
  readonly setupHref?: string;
  readonly agentName: string;
  readonly agentHandle: string;
  readonly agentRole: string;
  readonly isAgentActive: boolean;
  readonly hasCustomerChannel: boolean;
  readonly tab: AgentChatTab;
  readonly conversations: ReadonlyArray<AgentChatConversationView>;
  readonly messages: ReadonlyArray<AgentChatMessageView>;
  readonly hasSelection: boolean;
  readonly isLoadingList: boolean;
  readonly isSending: boolean;
  readonly isStarting: boolean;
  readonly draft: string;
  readonly visitorName: string;
  readonly error: string | null;
  readonly leadId: string | null;
  /** A human has taken the conversation over: the AI stays quiet and the composer sends as staff. */
  readonly isTakenOver: boolean;
  readonly isTakingOver: boolean;
  readonly onToggleTakeover: () => void;
  readonly onBack: () => void;
  readonly onTab: (tab: AgentChatTab) => void;
  readonly onDraft: (value: string) => void;
  readonly onVisitorName: (value: string) => void;
  readonly onSend: (prompt?: string) => void;
  readonly onStart: () => void;
  readonly onSelect: (conversationId: string, kind: AgentChatTab) => void;
  readonly onOpenLead: (leadId: string) => void;
};

const CUSTOMER_PROMPTS = ["customerPrompt1", "customerPrompt2", "customerPrompt3"] as const;
const TEAM_PROMPTS = ["teamPrompt1", "teamPrompt2", "teamPrompt3"] as const;
const NEXT_STEPS = [
  { title: "next1Title", body: "next1Body" },
  { title: "next2Title", body: "next2Body" },
  { title: "next3Title", body: "next3Body" },
] as const;

const Bubbles = (props: AgentChatBaseProps) => {
  const t = useT(agentChat);
  return (
    <>
      {props.messages.map((message) => {
        if (message.role === "system") {
          return <div className={NOTICE_ROW_CLASS_NAME} key={message.id}><Text size="xs" tone="muted">{message.body}</Text></div>;
        }
        const isUser = message.role === "user";
        return (
          <div className={isUser ? MESSAGE_ROW_USER_CLASS_NAME : MESSAGE_ROW_CLASS_NAME} key={message.id}>
            {isUser ? null : <AgentAvatar module={props.agentModule} size="sm" label={props.agentName} />}
            <div className={isUser ? BUBBLE_STACK_USER_CLASS_NAME : BUBBLE_STACK_CLASS_NAME}>
              <Text size="xs" tone="muted">{`${isUser ? (props.tab === "test" ? t("fromYou") : t("fromVisitor")) : props.agentName} · ${message.timeLabel}`}</Text>
              <div className={isUser ? BUBBLE_USER_CLASS_NAME : BUBBLE_CLASS_NAME}><Text size="sm">{message.body}</Text></div>
            </div>
          </div>
        );
      })}
      {props.isSending ? <Text size="sm" tone="muted" live="polite">{t("typing", { name: props.agentName })}</Text> : null}
    </>
  );
};

const EmptyThread = (props: AgentChatBaseProps) => {
  const t = useT(agentChat);
  const isCustomer = props.tab === "customer";
  return (
    <div className={EMPTY_CLASS_NAME}>
      <AgentAvatar module={props.agentModule} size="lg" label={props.agentName} online={props.isAgentActive} />
      <Text weight="semibold">{t("emptyGreeting", { name: props.agentName })}</Text>
      <Text as="p" size="sm" tone="muted">{isCustomer ? t("customerEmptyHelp") : t("emptyGreetingHelp")}</Text>
      {isCustomer ? (
        <div className={EMPTY_FIELD_CLASS_NAME}>
          <Input id="agent-chat-visitor" name="visitor" label={t("visitorName")} variant="secondary" value={props.visitorName} onValueChange={props.onVisitorName} />
        </div>
      ) : (
        <div className={EMPTY_CHIPS_CLASS_NAME}>
          {(props.hasCustomerChannel ? CUSTOMER_PROMPTS : TEAM_PROMPTS).map((key) => (
            <Button key={key} variant="outline" size="sm" isDisabled={props.isSending} onPress={() => props.onSend(t(key))}>{t(key)}</Button>
          ))}
        </div>
      )}
      <Button variant="primary" isPending={props.isStarting} onPress={props.onStart}>{isCustomer ? t("startVisitor") : t("startTest")}</Button>
      {isCustomer ? (
        <div className={STEP_LIST_CLASS_NAME}>
          {NEXT_STEPS.map((step, index) => (
            <div key={step.title} className={STEP_ROW_CLASS_NAME}>
              <Text weight="semibold">{String(index + 1)}</Text>
              <Text as="p" size="sm" tone="muted">{`${t(step.title)}. ${t(step.body)}`}</Text>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

const Thread = (props: AgentChatBaseProps) => {
  const t = useT(agentChat);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [props.messages.length, props.isSending, props.hasSelection]);
  return (
    <div className={THREAD_CLASS_NAME} role="log" aria-label={t("messagesLabel")}>
      {props.banner ?? null}
      {props.hasSelection ? <Bubbles {...props} /> : <EmptyThread {...props} />}
      {props.tab === "customer" && props.leadId ? (
        <div className={NOTICE_ROW_CLASS_NAME} data-testid="handoff-notice">
          <Text size="xs" tone="muted"><a className={NOTICE_LINK_CLASS_NAME} href={`/leads/${props.leadId}#flow`}>{t("handoffGate")}</a></Text>
        </div>
      ) : null}
      {props.isTakenOver ? <div className={NOTICE_ROW_CLASS_NAME} data-testid="takeover-notice"><Text size="xs" tone="muted">{t("takenOverNotice")}</Text></div> : null}
      <div ref={endRef} />
    </div>
  );
};

const Composer = (props: AgentChatBaseProps) => {
  const t = useT(agentChat);
  const canSend = props.draft.trim().length > 0 && !props.isSending;
  return (
    <form
      className={COMPOSER_CLASS_NAME}
      aria-label={t("composerLabel")}
      onSubmit={(event) => { event.preventDefault(); if (canSend) props.onSend(); }}
    >
      {props.error ? <Alert tone="negative" title={t("notSent")} description={props.error} /> : null}
      {props.tab === "test" && props.hasSelection ? (
        <div className={CHIPS_CLASS_NAME}>
          {(props.hasCustomerChannel ? CUSTOMER_PROMPTS : TEAM_PROMPTS).map((key) => (
            <Button key={key} variant="outline" size="sm" isDisabled={props.isSending} onPress={() => props.onSend(t(key))}>{t(key)}</Button>
          ))}
        </div>
      ) : null}
      <div className={COMPOSER_ROW_CLASS_NAME}>
        <input
          id="agent-chat-message"
          name="message"
          type="text"
          autoComplete="off"
          aria-label={t("messageLabel")}
          className={COMPOSER_INPUT_CLASS_NAME}
          placeholder={props.isTakenOver ? t("staffPlaceholder") : props.tab === "customer" ? t("widgetPlaceholder") : t("messagePlaceholder", { name: props.agentName })}
          value={props.draft}
          onChange={(event) => props.onDraft(event.target.value)}
        />
        <Button type="submit" variant="primary" isPending={props.isSending} isDisabled={!canSend}>{t("send")}</Button>
      </div>
    </form>
  );
};

type ListProps = AgentChatBaseProps & { readonly onPick: (id: string, kind: AgentChatTab) => void };

const ConversationList = (props: ListProps) => {
  const t = useT(agentChat);
  return (
    <>
      <div className={LIST_HEAD_CLASS_NAME}>
        <Text weight="semibold">{t("railTitle")}</Text>
        <Button variant="outline" size="sm" isPending={props.isStarting} onPress={props.onStart}>{props.tab === "customer" ? t("newVisitor") : t("newTest")}</Button>
      </div>
      <div className={LIST_SCROLL_CLASS_NAME}>
        {!props.isLoadingList && props.conversations.length === 0 ? <Text as="p" size="sm" tone="muted">{t("railEmptyHelp")}</Text> : null}
        {props.conversations.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`${LIST_ITEM_CLASS_NAME} ${item.isSelected ? LIST_ITEM_ACTIVE_CLASS_NAME : ""}`}
            aria-current={item.isSelected ? "true" : undefined}
            onClick={() => props.onPick(item.id, item.kind)}
          >
            <AgentAvatar module={props.agentModule} size="md" label={item.title} />
            <span className={LIST_ITEM_COPY_CLASS_NAME}>
              <Text size="sm" weight="medium" overflow="truncate">{item.title}</Text>
              <Text size="xs" tone="muted" overflow="truncate">{`${item.kindLabel} · ${item.timeLabel}${item.hasLead ? ` · ${t("leadCaptured")}` : ""}`}</Text>
            </span>
          </button>
        ))}
      </div>
    </>
  );
};

/** Presentational agent chat, Zalo style: history list, then a thread that fills the page with the composer pinned at the bottom. */
export const AgentChatBase = (props: AgentChatBaseProps) => {
  const t = useT(agentChat);
  const [isListOpen, setIsListOpen] = useState(false);
  const onPick = (id: string, kind: AgentChatTab) => {
    props.onSelect(id, kind);
    setIsListOpen(false);
  };
  return (
    <div className={PAGE_CLASS_NAME}>
      <aside className={LIST_COLUMN_CLASS_NAME} aria-label={t("railTitle")}>
        <ConversationList {...props} onPick={onPick} />
      </aside>
      {isListOpen ? (
        <aside className={LIST_COLUMN_OPEN_CLASS_NAME} aria-label={t("railTitle")}>
          <ConversationList {...props} onPick={onPick} />
        </aside>
      ) : null}
      <section className={MAIN_CLASS_NAME} data-list={isListOpen ? "open" : "closed"} aria-label={t("pageLabel")}>
        <header className={HEADER_CLASS_NAME}>
          <span className={BACK_CLASS_NAME}><Button variant="ghost" size="sm" onPress={props.onBack}>{t("backModules")}</Button></span>
          <AgentAvatar module={props.agentModule} size="md" label={props.agentName} online={props.isAgentActive} />
          <div className={HEADER_COPY_CLASS_NAME}>
            <Text weight="semibold" overflow="truncate">{props.agentName}</Text>
            <Text size="xs" tone="muted" overflow="truncate">{props.tab === "customer" ? (props.isTakenOver ? t("takenOverStatus") : t("asVisitor")) : `${props.isAgentActive ? t("statusActive") : t("statusPaused")} · ${props.agentRole}`}</Text>
          </div>
          <div className={HEADER_ACTIONS_CLASS_NAME}>
            {props.tab === "customer" ? <Badge tone="success">{t("realAiBadge")}</Badge> : null}
            {props.tab === "customer" && props.hasSelection ? (
              <Button variant="outline" size="sm" isPending={props.isTakingOver} onPress={props.onToggleTakeover}>{props.isTakenOver ? t("giveBack") : t("takeOver")}</Button>
            ) : null}
            {props.leadId ? <Button variant="outline" size="sm" onPress={() => props.onOpenLead(props.leadId ?? "")}>{t("openLead")}</Button> : null}
            <Button variant="ghost" size="sm" onPress={() => setIsListOpen((open) => !open)}>{t("historyToggle")}</Button>
            {props.setupHref ? <Button variant="ghost" size="sm" href={props.setupHref}>{t("setupLink")}</Button> : null}
          </div>
        </header>
        {props.hasCustomerChannel ? (
          <div className={CHANNEL_BAR_CLASS_NAME}>
            <Tabs
              label={t("channelLabel")}
              selectedKey={props.tab}
              items={[{ id: "test", label: t("tabTest") }, { id: "customer", label: t("tabCustomer") }]}
              onSelect={(key) => props.onTab(key === "customer" ? "customer" : "test")}
              inset="none"
              labelVisibility="always"
            />
          </div>
        ) : null}
        <Thread {...props} />
        <Composer {...props} />
      </section>
    </div>
  );
};
