"use client";

import { Badge, EmptyNotice, Heading, SearchField, Text } from "@starci/grammar/common";
import { PersonAvatar } from "@/components/avatar/PersonAvatar";
import { useLocale, useT } from "@/i18n/client";
import { workbenchChatbot } from "@/i18n/dict/workbenchChatbot";
import { dayKey, listTime } from "@/features/office/format";
import type { WbConversation } from "@/lib/workbench-chatbot";
import {
  FILTER_ACTIVE_CLASS_NAME, FILTER_CLASS_NAME, FILTERS_CLASS_NAME, HEAD_CLASS_NAME, HEAD_TEXT_CLASS_NAME, LIST_BODY_CLASS_NAME, ROW_ACTIVE_CLASS_NAME,
  ROW_CHIPS_CLASS_NAME, ROW_CLASS_NAME, ROW_LINE_CLASS_NAME, ROW_TEXT_CLASS_NAME,
} from "./classNames";

export type InboxFilter = "all" | "needs" | "handled" | "today";
const FILTERS: ReadonlyArray<{ readonly id: InboxFilter; readonly key: "filterAll" | "filterNeedsPerson" | "filterHandled" | "filterToday" }> = [
  { id: "all", key: "filterAll" },
  { id: "needs", key: "filterNeedsPerson" },
  { id: "handled", key: "filterHandled" },
  { id: "today", key: "filterToday" },
];

/** Whether a conversation belongs to a filter. */
export const matchesFilter = (c: WbConversation, filter: InboxFilter, nowIso: string): boolean =>
  filter === "all" ? true : filter === "needs" ? c.waiting : filter === "handled" ? c.handledBy !== null : dayKey(c.lastAt) === dayKey(nowIso);

/** State chips of one conversation: who is replying and whether somebody is needed. */
export const StateChips = ({ conversation }: { readonly conversation: WbConversation }) => {
  const t = useT(workbenchChatbot);
  return (
    <span className={ROW_CHIPS_CLASS_NAME}>
      {conversation.waiting ? <Badge tone="warning" isDot>{t("chipWaiting")}</Badge> : null}
      {conversation.handledBy ? <Badge tone="accent" isDot>{t("chipHandled", { name: conversation.handledBy })}</Badge> : null}
      {!conversation.waiting && !conversation.handledBy ? <Badge tone="neutral">{t("chipAi")}</Badge> : null}
      {conversation.unanswered && !conversation.waiting ? <Badge tone="warning">{t("chipUnanswered")}</Badge> : null}
    </span>
  );
};

/** Left pane: filters, search and the conversation rows. */
export const ConversationPane = (props: {
  readonly conversations: ReadonlyArray<WbConversation>;
  readonly total: number;
  readonly nowIso: string;
  readonly selectedId: string | null;
  readonly filter: InboxFilter;
  readonly query: string;
  readonly onFilter: (f: InboxFilter) => void;
  readonly onQuery: (q: string) => void;
  readonly onSelect: (id: string) => void;
}) => {
  const t = useT(workbenchChatbot);
  const locale = useLocale();
  const words = { today: t("today"), yesterday: t("yesterday") };
  return (
    <>
      <div className={HEAD_CLASS_NAME}>
        <div className={HEAD_TEXT_CLASS_NAME}>
          <Heading level={2}>{t("title")}</Heading>
        </div>
      </div>
      <div className="shrink-0 px-3 pt-3 pb-2">
        <SearchField label={t("searchLabel")} isLabelHidden placeholder={t("searchPlaceholder")} clearLabel={t("clearSearch")} value={props.query} onValueChange={props.onQuery} onClear={() => props.onQuery("")} />
      </div>
      <div className={FILTERS_CLASS_NAME} role="group" aria-label={t("listLabel")}>
        {FILTERS.map((f) => (
          <button key={f.id} type="button" aria-pressed={props.filter === f.id} className={`${FILTER_CLASS_NAME} ${props.filter === f.id ? FILTER_ACTIVE_CLASS_NAME : ""}`} onClick={() => props.onFilter(f.id)}>
            {t(f.key)}
          </button>
        ))}
      </div>
      {props.conversations.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6">
          {props.total === 0 ? <EmptyNotice message={t("emptyListTitle")} description={t("emptyListBody")} /> : <Text size="sm" tone="muted">{t("emptyFilter")}</Text>}
        </div>
      ) : (
        <nav className={LIST_BODY_CLASS_NAME} aria-label={t("listLabel")}>
          {props.conversations.map((c) => {
            const name = c.name || t("unknownCustomer");
            const prefix = c.lastRole === "agent" ? `${t("youPrefix")}: ` : "";
            return (
              <button key={c.id} type="button" aria-current={props.selectedId === c.id ? "true" : undefined} className={`${ROW_CLASS_NAME} ${props.selectedId === c.id ? ROW_ACTIVE_CLASS_NAME : ""}`} onClick={() => props.onSelect(c.id)}>
                <PersonAvatar name={name} size="md" />
                <span className={ROW_TEXT_CLASS_NAME}>
                  <span className={ROW_LINE_CLASS_NAME}>
                    <Text size="sm" weight={c.unanswered || c.waiting ? "semibold" : "medium"} overflow="truncate">{name}</Text>
                    <Text size="xs" tone="muted">{listTime(c.lastAt, props.nowIso, locale, words)}</Text>
                  </span>
                  <Text size="sm" tone="muted" overflow="truncate">{c.lastText ? `${prefix}${c.lastText}` : t("noMessages")}</Text>
                  <span className={ROW_CHIPS_CLASS_NAME}>
                    <Badge tone="neutral">{c.channel === "telegram" ? t("channelTelegram") : c.channel === "zalo" ? t("channelZalo") : t("channelWebsite")}</Badge>
                    <StateChips conversation={c} />
                  </span>
                </span>
              </button>
            );
          })}
        </nav>
      )}
    </>
  );
};
