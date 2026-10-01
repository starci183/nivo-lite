"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { Alert, Badge, Button, Heading, Icon, IconButton, Text, Textarea } from "@starci/grammar/common";
import { nivoIconSource } from "@/ui";
import { PersonAvatar } from "@/components/avatar/PersonAvatar";
import { useLocale, useT } from "@/i18n/client";
import { workbenchChatbot } from "@/i18n/dict/workbenchChatbot";
import { dayKey, dayLabel, formatTime } from "@/features/office/format";
import type { WbMessage, WbThread } from "@/lib/workbench-chatbot";
import {
  BACK_GLYPH_CLASS_NAME, BUBBLE_AI_CLASS_NAME, BUBBLE_HUMAN_CLASS_NAME, BUBBLE_IN_CLASS_NAME, COMPOSER_CLASS_NAME, COMPOSER_FIELD_CLASS_NAME,
  COMPOSER_ROW_CLASS_NAME, DELIVERY_CLASS_NAME, HEAD_CLASS_NAME, HEAD_TEXT_CLASS_NAME, MSG_AUTHOR_CLASS_NAME, MSG_COLUMN_CLASS_NAME,
  MSG_COLUMN_OUT_CLASS_NAME, MSG_ROW_CLASS_NAME, MSG_ROW_OUT_CLASS_NAME, PHONE_ONLY_CLASS_NAME, SYSTEM_LINE_CLASS_NAME, SYSTEM_RULE_CLASS_NAME,
  THREAD_SCROLL_CLASS_NAME,
} from "./classNames";
import { StateChips } from "./list";

type Translate = ReturnType<typeof useT<typeof workbenchChatbot.en>>;

const DayRule = ({ label }: { readonly label: string }) => (
  <div className={SYSTEM_LINE_CLASS_NAME} role="separator" aria-label={label}>
    <span className={SYSTEM_RULE_CLASS_NAME} />
    <Text size="xs" tone="muted" weight="medium">{label}</Text>
    <span className={SYSTEM_RULE_CLASS_NAME} />
  </div>
);

const Delivery = ({ message, channel, t }: { readonly message: WbMessage; readonly channel: "telegram" | "website"; readonly t: Translate }) => {
  if (message.delivery === "failed") return <Text size="xs" weight="medium" tone="accent" live="polite">{t("deliveryFailed")}</Text>;
  if (message.delivery === "sent") return <Text size="xs" tone="muted">{channel === "telegram" ? t("deliverySent") : t("deliveryWebsite")}</Text>;
  return null;
};

const Bubble = ({ message, customerName, channel, locale, t }: {
  readonly message: WbMessage; readonly customerName: string; readonly channel: "telegram" | "website";
  readonly locale: ReturnType<typeof useLocale>; readonly t: Translate;
}) => {
  const out = message.role === "agent";
  const human = out && message.authorKind === "human";
  const author = !out ? customerName : human ? (message.authorName ?? t("roleAi")) : t("roleAi");
  return (
    <div className={`${MSG_ROW_CLASS_NAME} ${out ? MSG_ROW_OUT_CLASS_NAME : ""}`}>
      {!out ? <PersonAvatar name={customerName} size="sm" /> : null}
      <div className={`${MSG_COLUMN_CLASS_NAME} ${out ? MSG_COLUMN_OUT_CLASS_NAME : ""}`}>
        <div className={MSG_AUTHOR_CLASS_NAME}>
          {out && !human ? <Badge tone="neutral">{t("aiChip")}</Badge> : null}
          <Text size="xs" weight="medium">{author}</Text>
          <Text size="xs" tone="muted">{formatTime(message.createdAt, locale)}</Text>
        </div>
        <div className={!out ? BUBBLE_IN_CLASS_NAME : human ? BUBBLE_HUMAN_CLASS_NAME : BUBBLE_AI_CLASS_NAME}>
          <Text as="p" size="sm">{message.body}</Text>
        </div>
        {out ? <span className={DELIVERY_CLASS_NAME}><Delivery message={message} channel={channel} t={t} /></span> : null}
      </div>
      {human ? <PersonAvatar name={message.authorName ?? "?"} size="sm" /> : null}
    </div>
  );
};

/** Centre pane: header, bubbles and the composer (active only while the signed-in member holds the conversation). */
export const ThreadPane = (props: {
  readonly thread: WbThread | null;
  readonly isLoading: boolean;
  readonly nowIso: string;
  readonly userName: string;
  readonly infoOpen: boolean;
  readonly onBack: () => void;
  readonly onToggleInfo: () => void;
  readonly onSend: (text: string) => Promise<string | null>;
}) => {
  const t = useT(workbenchChatbot);
  const locale = useLocale();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const { thread } = props;
  const count = thread?.messages.length ?? 0;
  const lastId = thread?.messages.at(-1)?.id;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [thread?.conversation.id, count, lastId]);
  useEffect(() => {
    setDraft("");
    setError(null);
  }, [thread?.conversation.id]);

  if (!thread) {
    return <div className="flex flex-1 items-center justify-center p-6"><Text size="sm" tone="muted">{props.isLoading ? "…" : t("pickBody")}</Text></div>;
  }

  const conv = thread.conversation;
  const name = conv.name || t("unknownCustomer");
  const mine = conv.handledBy !== null && conv.handledBy === props.userName;
  const words = { today: t("today"), yesterday: t("yesterday") };

  const send = async () => {
    const text = draft.trim();
    if (!text || isSending) return;
    setIsSending(true);
    setError(null);
    const failure = await props.onSend(text);
    setIsSending(false);
    if (failure) setError(failure);
    else setDraft("");
  };

  let lastDay = "";
  return (
    <>
      <header className={HEAD_CLASS_NAME}>
        <div className={`${PHONE_ONLY_CLASS_NAME} ${BACK_GLYPH_CLASS_NAME}`}>
          <IconButton source={nivoIconSource("next", "leading")} label={t("back")} onPress={props.onBack} />
        </div>
        <PersonAvatar name={name} size="md" />
        <div className={HEAD_TEXT_CLASS_NAME}>
          <Heading level={2}>{name}</Heading>
          <span className="flex flex-wrap items-center gap-1">
            <Badge tone="neutral">{conv.channel === "telegram" ? t("channelTelegram") : t("channelWebsite")}</Badge>
            <StateChips conversation={conv} />
          </span>
        </div>
        <IconButton source={nivoIconSource("sidebar", "leading")} label={props.infoOpen ? t("infoClose") : t("infoOpen")} isActive={props.infoOpen} onPress={props.onToggleInfo} />
      </header>

      <div className={THREAD_SCROLL_CLASS_NAME}>
        {thread.messages.map((m) => {
          const key = dayKey(m.createdAt);
          const showDay = key !== lastDay;
          lastDay = key;
          return (
            <Fragment key={m.id}>
              {showDay ? <DayRule label={dayLabel(key, props.nowIso, locale, words)} /> : null}
              {m.role === "system" ? (
                <div className={SYSTEM_LINE_CLASS_NAME}>
                  <span className={SYSTEM_RULE_CLASS_NAME} />
                  <Text size="xs" tone="muted">{m.body}</Text>
                  <span className={SYSTEM_RULE_CLASS_NAME} />
                </div>
              ) : (
                <Bubble message={m} customerName={name} channel={conv.channel} locale={locale} t={t} />
              )}
            </Fragment>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className={COMPOSER_CLASS_NAME}>
        {error ? <Alert tone="negative" title={t("notSent")} description={error} /> : null}
        {mine ? (
          <>
            <div className={COMPOSER_ROW_CLASS_NAME}>
              <div className={COMPOSER_FIELD_CLASS_NAME}>
                <Textarea label={t("composerLabel")} isLabelHidden placeholder={t("composerPlaceholder")} rows={2} value={draft} onValueChange={setDraft} />
              </div>
              <Button variant="primary" isPending={isSending} isDisabled={draft.trim().length === 0} onPress={() => void send()} startContent={<Icon source={nivoIconSource("send", "leading")} usage="leading" />}>
                {t("send")}
              </Button>
            </div>
            <Text size="xs" tone="muted">{t(conv.channel === "telegram" ? "composerHintTelegram" : "composerHintWebsite", { name: props.userName })}</Text>
          </>
        ) : (
          <Text size="sm" tone="muted">{conv.handledBy ? t("composerLockedOther", { name: conv.handledBy }) : t("composerLocked")}</Text>
        )}
      </div>
    </>
  );
};
