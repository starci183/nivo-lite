"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { Alert, Badge, Button, ChatBubble, ChatBubbleSkeletons, Divider, Heading, Icon, IconButton, Text, Textarea } from "@starci/grammar/common";
import { nivoIconSource } from "@/components/leaves/Icon"
import { PersonAvatar } from "@/components/leaves/PersonAvatar"
import { useLocale, useT } from "@/i18n/client";
import { workbenchChatbot } from "@/i18n/dict/workbenchChatbot";
import { dayKey, dayLabel, formatTime } from "@/features/office/format";
import type { WbChannel, WbMessage, WbThread } from "@/lib/workbench-chatbot";
import {
  CENTER_CLASS_NAME, CHIPS_CLASS_NAME, COMPOSER_CLASS_NAME, COMPOSER_FIELD_CLASS_NAME,
  COMPOSER_ROW_CLASS_NAME, HEAD_CLASS_NAME, HEAD_TEXT_CLASS_NAME, PHONE_ONLY_CLASS_NAME, THREAD_SCROLL_CLASS_NAME,
} from "./classNames";
import { StateChips } from "./list";

type Translate = ReturnType<typeof useT<typeof workbenchChatbot.en>>;

const Delivery = ({ message, channel, t }: { readonly message: WbMessage; readonly channel: WbChannel; readonly t: Translate }) => {
  if (message.delivery === "failed") {
    const reason = message.deliveryError ? t(`err_${message.deliveryError}` as Parameters<Translate>[0]) : null
    return (
      <Text size="xs" weight="medium" tone="accent" live="polite">
        {channel === "zalo" ? t("deliveryFailedZalo") : channel === "facebook" || channel === "instagram" ? t("deliveryFailedMeta") : t("deliveryFailed")}{reason && reason !== `err_${message.deliveryError}` ? ` · ${t("deliveryWhy", { reason })}` : ""}
      </Text>
    )
  }
  if (message.delivery === "sent") return <Text size="xs" tone="muted">{channel === "telegram" ? t("deliverySent") : channel === "zalo" ? t("deliverySentZalo") : channel === "facebook" || channel === "instagram" ? t("deliverySentMeta") : t("deliveryWebsite")}</Text>;
  return null;
};

const Bubble = ({ message, customerName, channel, locale, t }: {
  readonly message: WbMessage; readonly customerName: string; readonly channel: WbChannel;
  readonly locale: ReturnType<typeof useLocale>; readonly t: Translate;
}) => {
  const out = message.role === "agent";
  const human = out && message.authorKind === "human";
  const author = !out ? customerName : human ? (message.authorName ?? t("roleAi")) : t("roleAi");
  return (
    <ChatBubble
      side={out ? "outgoing" : "incoming"}
      author={author}
      meta={formatTime(message.createdAt, locale)}
      status={out && !human ? <Badge tone="neutral">{t("aiChip")}</Badge> : undefined}
      avatar={!out ? <PersonAvatar name={customerName} size="sm" /> : human ? <PersonAvatar name={message.authorName ?? "?"} size="sm" /> : undefined}
      footer={out && (message.delivery === "failed" || message.delivery === "sent") ? <Delivery message={message} channel={channel} t={t} /> : undefined}
    >
      {message.body}
    </ChatBubble>
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
    if (props.isLoading) return <div className={CENTER_CLASS_NAME}><ChatBubbleSkeletons count={3} hasAvatar /></div>;
    return <div className={CENTER_CLASS_NAME}><Text size="sm" tone="muted">{t("pickBody")}</Text></div>;
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
      <div className={HEAD_CLASS_NAME}>
        <div className={PHONE_ONLY_CLASS_NAME}>
          <IconButton source={nivoIconSource("back", "leading")} label={t("back")} onPress={props.onBack} />
        </div>
        <PersonAvatar name={name} size="md" />
        <div className={HEAD_TEXT_CLASS_NAME}>
          <Heading level={2}>{name}</Heading>
          <span className={CHIPS_CLASS_NAME}>
            <Badge tone="neutral">{conv.channel === "telegram" ? t("channelTelegram") : conv.channel === "zalo" ? t("channelZalo") : conv.channel === "facebook" ? t("channelFacebook") : conv.channel === "instagram" ? t("channelInstagram") : t("channelWebsite")}</Badge>
            <StateChips conversation={conv} />
          </span>
        </div>
        <IconButton source={nivoIconSource("sidebar", "leading")} label={props.infoOpen ? t("infoClose") : t("infoOpen")} isActive={props.infoOpen} onPress={props.onToggleInfo} />
      </div>

      <div className={THREAD_SCROLL_CLASS_NAME}>
        {thread.messages.map((m) => {
          const key = dayKey(m.createdAt);
          const showDay = key !== lastDay;
          lastDay = key;
          return (
            <Fragment key={m.id}>
              {showDay ? <Divider label={dayLabel(key, props.nowIso, locale, words)} /> : null}
              {m.role === "system" ? (
                <Divider label={m.body} />
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
                <Textarea label={t("composerLabel")} isLabelHidden variant="secondary" placeholder={t("composerPlaceholder")} rows={2} value={draft} onValueChange={setDraft} />
              </div>
              <Button variant="primary" isPending={isSending} isDisabled={draft.trim().length === 0} onPress={() => void send()} startContent={<Icon source={nivoIconSource("send", "leading")} usage="leading" />}>
                {t("send")}
              </Button>
            </div>
            <Text size="xs" tone="muted">{t(conv.channel === "telegram" ? "composerHintTelegram" : conv.channel === "zalo" ? "composerHintZalo" : conv.channel === "facebook" || conv.channel === "instagram" ? "composerHintMeta" : "composerHintWebsite", { name: props.userName })}</Text>
          </>
        ) : (
          <Text size="sm" tone="muted">{conv.handledBy ? t("composerLockedOther", { name: conv.handledBy }) : t("composerLocked")}</Text>
        )}
      </div>
    </>
  );
};
