"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AgentAvatar } from "@/components/blocks/AgentAvatar"
import { useT } from "@/i18n/client";
import { agentChat } from "@/i18n/dict/agentChat";
import { modulesCore } from "@/i18n/dict/modulesCore";
import { shell } from "@/i18n/dict/shell";
import { Alert, Avatar, Badge, Breadcrumbs, Button, ChatBubble, ChatBubbleSkeletons, FillViewport, Form, Input, Link, ListBox, SurfaceCard, Tabs, Text, Textarea } from "@starci/grammar/common";
import {
  BACK_CLASS_NAME, FRAME_CLASS_NAME, CHANNEL_BAR_CLASS_NAME, CHIPS_CLASS_NAME,
  COMPOSER_CLASS_NAME, COMPOSER_INPUT_CLASS_NAME, COMPOSER_ROW_CLASS_NAME, EMPTY_CHIPS_CLASS_NAME, EMPTY_CLASS_NAME, EMPTY_FIELD_CLASS_NAME,
  HEADER_ACTIONS_CLASS_NAME, HEADER_CLASS_NAME, HEADER_COPY_CLASS_NAME, LIST_COLUMN_CLASS_NAME, LIST_COLUMN_OPEN_CLASS_NAME, LIST_HEAD_CLASS_NAME,
  LIST_SCROLL_CLASS_NAME, MAIN_CLASS_NAME,
  NOTICE_ROW_CLASS_NAME, STEP_LIST_CLASS_NAME, STEP_ROW_CLASS_NAME, THREAD_CLASS_NAME,
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
  /** STATE-8: the same chat while the agent and its conversations load - the frame, labels and composer stay; names, the list and the thread are skeletons. */
  readonly isLoading?: boolean;
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
          <ChatBubble
            key={message.id}
            side={isUser ? "outgoing" : "incoming"}
            author={isUser ? (props.tab === "test" ? t("fromYou") : t("fromVisitor")) : props.agentName}
            avatar={isUser ? undefined : <AgentAvatar module={props.agentModule} size="sm" label={props.agentName} />}
            meta={message.timeLabel}
          >
            {message.body}
          </ChatBubble>
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
      <AgentAvatar module={props.agentModule} size="lg" label={props.agentName} />
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
      {props.isLoading ? <ChatBubbleSkeletons count={4} hasAvatar /> : props.hasSelection ? <Bubbles {...props} /> : <EmptyThread {...props} />}
      {props.tab === "customer" && props.leadId ? (
        <div className={NOTICE_ROW_CLASS_NAME} data-testid="handoff-notice">
          <Text size="xs" tone="muted"><Link href={`/leads/${props.leadId}#flow`}>{t("handoffGate")}</Link></Text>
        </div>
      ) : null}
      {props.isTakenOver ? <div className={NOTICE_ROW_CLASS_NAME} data-testid="takeover-notice"><Text size="xs" tone="muted">{t("takenOverNotice")}</Text></div> : null}
      <div ref={endRef} />
    </div>
  );
};

const Composer = (props: AgentChatBaseProps) => {
  const t = useT(agentChat);
  const canSend = props.draft.trim().length > 0 && !props.isSending && !props.isLoading;
  return (
    <div className={COMPOSER_CLASS_NAME}>
      <Form label={t("composerLabel")} isPending={props.isSending} onSubmit={(_data, event) => { event.preventDefault(); if (canSend) props.onSend(); }}>
        {props.error ? <Alert tone="negative" title={t("notSent")} description={props.error} /> : null}
        {props.tab === "test" && props.hasSelection ? (
          <div className={CHIPS_CLASS_NAME}>
            {(props.hasCustomerChannel ? CUSTOMER_PROMPTS : TEAM_PROMPTS).map((key) => (
              <Button key={key} variant="outline" size="sm" isDisabled={props.isSending} onPress={() => props.onSend(t(key))}>{t(key)}</Button>
            ))}
          </div>
        ) : null}
        <div className={COMPOSER_ROW_CLASS_NAME}>
          {/* The Grammar Textarea owns Enter-to-send (Shift+Enter breaks the line). */}
          <div className={COMPOSER_INPUT_CLASS_NAME}>
            <Textarea
              id="agent-chat-message"
              name="message"
              label={t("messageLabel")}
              isLabelHidden
              variant="secondary"
              rows={1}
              isSkeleton={props.isLoading}
              placeholder={props.isLoading ? t("messageLabel") : props.isTakenOver ? t("staffPlaceholder") : props.tab === "customer" ? t("widgetPlaceholder") : t("messagePlaceholder", { name: props.agentName })}
              value={props.draft}
              onValueChange={props.onDraft}
              onSubmitShortcut={() => { if (canSend) props.onSend(); }}
            />
          </div>
          <Button type="submit" variant="primary" isPending={props.isSending} isDisabled={!canSend}>{t("send")}</Button>
        </div>
      </Form>
    </div>
  );
};

type ListProps = AgentChatBaseProps & { readonly onPick: (id: string, kind: AgentChatTab) => void };

const ConversationList = (props: ListProps) => {
  const t = useT(agentChat);
  return (
    <>
      <div className={LIST_HEAD_CLASS_NAME}>
        <Text weight="semibold">{t("railTitle")}</Text>
        <Button variant="outline" size="sm" isDisabled={props.isLoading} isPending={props.isStarting} onPress={props.onStart}>{props.tab === "customer" ? t("newVisitor") : t("newTest")}</Button>
      </div>
      <div className={LIST_SCROLL_CLASS_NAME}>
        {props.isLoading ? <ListBox label={t("railTitle")} items={[]} isLoading loadingRows={3} /> : null}
        {!props.isLoading && !props.isLoadingList && props.conversations.length === 0 ? <Text as="p" size="sm" tone="muted">{t("railEmptyHelp")}</Text> : null}
        {props.isLoading || props.conversations.length === 0 ? null : (
          // The Grammar ListBox owns the rows, the selected face and the keyboard model (SURFACE-4, FOCUS-2).
          <ListBox
            label={t("railTitle")}
            selectionMode="single"
            selectedIds={props.conversations.filter((item) => item.isSelected).map((item) => item.id)}
            onSelectionChange={(ids) => {
              const picked = props.conversations.find((item) => item.id === ids[0]);
              if (picked) props.onPick(picked.id, picked.kind);
            }}
            items={props.conversations.map((item) => ({
              id: item.id,
              label: item.title,
              description: `${item.kindLabel} · ${item.timeLabel}${item.hasLead ? ` · ${t("leadCaptured")}` : ""}`,
              leading: <AgentAvatar module={props.agentModule} size="md" label={item.title} />,
            }))}
          />
        )}
      </div>
    </>
  );
};

/** Presentational agent chat, Zalo style: history list, then a thread that fills the page with the composer pinned at the bottom. */
export const AgentChatBase = (props: AgentChatBaseProps) => {
  const t = useT(agentChat);
  const tm = useT(modulesCore);
  const ts = useT(shell);
  const [isListOpen, setIsListOpen] = useState(false);
  const onPick = (id: string, kind: AgentChatTab) => {
    props.onSelect(id, kind);
    setIsListOpen(false);
  };
  return (
    <>
    <Breadcrumbs
      label={ts("crumbLabel")}
      items={[
        { id: "home", label: ts("crumbHome"), href: "/dashboard" },
        { id: "modules", label: tm("catalogTitle"), href: "/agents" },
        props.isLoading ? { id: "agent", label: "", isSkeleton: true as const } : { id: "agent", label: props.agentName },
      ]}
    />
    <FillViewport minHeight="md" bottomInset="page">
      {/* FillViewport owns the page height below the chrome; SURFACE-2 / BOUNDARY-6: the chat is one top-level card, its
          columns are joined faces inside it. */}
      <SurfaceCard ariaLabel={t("pageLabel")} composition="joined" height="fill">
      <div className={FRAME_CLASS_NAME}>
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
          {props.isLoading ? <Avatar name="" size="md" isSkeleton /> : <AgentAvatar module={props.agentModule} size="md" label={props.agentName} />}
          <div className={HEADER_COPY_CLASS_NAME}>
            <Text weight="semibold" overflow="truncate" isSkeleton={props.isLoading}>{props.agentName}</Text>
            <Text size="xs" tone="muted" overflow="truncate" isSkeleton={props.isLoading}>{props.tab === "customer" ? (props.isTakenOver ? t("takenOverStatus") : t("asVisitor")) : `${props.isAgentActive ? t("statusActive") : t("statusPaused")} · ${props.agentRole}`}</Text>
          </div>
          <div className={HEADER_ACTIONS_CLASS_NAME}>
            {props.tab === "customer" ? <Badge tone="success">{t("realAiBadge")}</Badge> : null}
            {props.tab === "customer" && props.hasSelection ? (
              <Button variant="outline" size="sm" isPending={props.isTakingOver} onPress={props.onToggleTakeover}>{props.isTakenOver ? t("giveBack") : t("takeOver")}</Button>
            ) : null}
            {props.leadId ? <Button variant="outline" size="sm" onPress={() => props.onOpenLead(props.leadId ?? "")}>{t("openLead")}</Button> : null}
            <Button variant="ghost" size="sm" isDisabled={props.isLoading} onPress={() => setIsListOpen((open) => !open)}>{t("historyToggle")}</Button>
            {props.setupHref ? <Button variant="ghost" size="sm" href={props.setupHref}>{t("setupLink")}</Button> : null}
          </div>
        </header>
        {props.hasCustomerChannel && !props.isLoading ? (
          <div className={CHANNEL_BAR_CLASS_NAME}>
            <Tabs variant="secondary"
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
      </SurfaceCard>
    </FillViewport>
    </>
  );
};
