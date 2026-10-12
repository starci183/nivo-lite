"use client";

import { Badge, EmptyNotice, Heading, HorizontalScrollRegion, ListBox, SearchField, SegmentedControl, Text } from "@starci/grammar/common";
import { PersonAvatar } from "@/components/leaves/PersonAvatar"
import { useLocale, useT } from "@/i18n/client";
import { workbenchChatbot } from "@/i18n/dict/workbenchChatbot";
import { dayKey, listTime } from "@/features/office/format";
import type { WbConversation } from "@/lib/workbench-chatbot";
import { CENTER_CLASS_NAME, CHIPS_CLASS_NAME, FILTERS_CLASS_NAME, HEAD_CLASS_NAME, HEAD_TEXT_CLASS_NAME, LIST_BODY_CLASS_NAME, SEARCH_CLASS_NAME } from "./classNames";

export type InboxFilter = "all" | "needs" | "handled" | "today";
const isFilter = (v: string): v is InboxFilter => v === "all" || v === "needs" || v === "handled" || v === "today";
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
    <span className={CHIPS_CLASS_NAME}>
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
      <div className={SEARCH_CLASS_NAME}>
        <SearchField label={t("searchLabel")} isLabelHidden placeholder={t("searchPlaceholder")} clearLabel={t("clearSearch")} value={props.query} onValueChange={props.onQuery} onClear={() => props.onQuery("")} />
      </div>
      <div className={FILTERS_CLASS_NAME}>
        <HorizontalScrollRegion overflow="needed" isFocusable={false}>
          <SegmentedControl
            label={t("listLabel")}
            isLabelHidden
            options={FILTERS.map((f) => ({ value: f.id, label: t(f.key) }))}
            value={props.filter}
            onValueChange={(v) => { if (isFilter(v)) props.onFilter(v); }}
          />
        </HorizontalScrollRegion>
      </div>
      {props.conversations.length === 0 ? (
        <div className={CENTER_CLASS_NAME}>
          {props.total === 0 ? <EmptyNotice message={t("emptyListTitle")} description={t("emptyListBody")} /> : <EmptyNotice message={t("emptyFilter")} />}
        </div>
      ) : (
        <div className={LIST_BODY_CLASS_NAME}>
          <ListBox
            label={t("listLabel")}
            selectionMode="single"
            selectedIds={props.selectedId ? [props.selectedId] : []}
            onSelectionChange={(ids) => {
              const id = ids[0] ?? props.selectedId;
              if (id) props.onSelect(id);
            }}
            items={props.conversations.map((c) => {
              const name = c.name || t("unknownCustomer");
              const prefix = c.lastRole === "agent" ? `${t("youPrefix")}: ` : "";
              return {
                id: c.id,
                label: name,
                leading: <PersonAvatar name={name} size="md" />,
                trailing: <Text as="span" size="xs" tone="muted">{listTime(c.lastAt, props.nowIso, locale, words)}</Text>,
                description: (
                  <>
                    <Text size="sm" tone="muted" overflow="truncate">{c.lastText ? `${prefix}${c.lastText}` : t("noMessages")}</Text>
                    <span className={CHIPS_CLASS_NAME}>
                      <Badge tone="neutral">{c.channel === "telegram" ? t("channelTelegram") : c.channel === "zalo" ? t("channelZalo") : c.channel === "facebook" ? t("channelFacebook") : c.channel === "instagram" ? t("channelInstagram") : t("channelWebsite")}</Badge>
                      <StateChips conversation={c} />
                    </span>
                  </>
                ),
              };
            })}
          />
        </div>
      )}
    </>
  );
};
