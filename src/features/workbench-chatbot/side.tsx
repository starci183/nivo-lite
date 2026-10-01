"use client";

import { useEffect, useState } from "react";
import { Alert, Badge, Button, Heading, IconButton, Text, Textarea } from "@starci/grammar/common";
import { nivoIconSource } from "@/ui";
import { PersonAvatar } from "@/components/avatar/PersonAvatar";
import { useT } from "@/i18n/client";
import { workbenchChatbot } from "@/i18n/dict/workbenchChatbot";
import type { WbThread } from "@/lib/workbench-chatbot";
import {
  ACTIONS_CLASS_NAME, CUSTOMER_HEAD_CLASS_NAME, ESCALATION_CLASS_NAME, HEAD_CLASS_NAME, HEAD_TEXT_CLASS_NAME, QUOTE_CLASS_NAME, SIDE_FACTS_CLASS_NAME, SIDE_SECTION_CLASS_NAME,
} from "./classNames";

const STAGES = ["new", "qualified", "proposal", "won", "lost"] as const;

const Fact = ({ label, value }: { readonly label: string; readonly value: string | null }) =>
  value ? (
    <>
      <Text size="xs" tone="muted">{label}</Text>
      <Text size="sm" overflow="clamp-2">{value}</Text>
    </>
  ) : null;

/** Right pane: customer, who is replying (take over / hand back), the waiting escalation and the lead. */
export const SidePane = (props: {
  readonly thread: WbThread | null;
  readonly userName: string;
  readonly isBusy: boolean;
  readonly onClose: () => void;
  readonly onTakeOver: () => void;
  readonly onHandBack: () => void;
  readonly onAnswer: (text: string | null) => Promise<string | null>;
}) => {
  const t = useT(workbenchChatbot);
  const { thread } = props;
  const escalation = thread?.escalation ?? null;
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState<{ readonly tone: "negative" | "affirmative"; readonly text: string } | null>(null);
  const [isSending, setIsSending] = useState(false);
  const escalationId = escalation?.workItemId ?? null;
  const initialDraft = escalation?.draft ?? "";

  useEffect(() => {
    setDraft(initialDraft);
    setNotice(null);
    // Reset only when a different escalation opens, never on every realtime refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escalationId]);

  const answer = async (text: string | null) => {
    setIsSending(true);
    const failure = await props.onAnswer(text);
    setIsSending(false);
    setNotice(failure ? { tone: "negative", text: failure } : null);
  };

  const closeButton = (
    <IconButton source={nivoIconSource("close", "leading")} label={t("infoClose")} onPress={props.onClose} />
  );

  if (!thread) {
    return <div className={HEAD_CLASS_NAME}><div className={HEAD_TEXT_CLASS_NAME} /><div className="xl:hidden">{closeButton}</div></div>;
  }

  const conv = thread.conversation;
  const name = conv.name || t("unknownCustomer");
  const mine = conv.handledBy !== null && conv.handledBy === props.userName;
  const lead = thread.lead;
  const stage = lead && (STAGES as ReadonlyArray<string>).includes(lead.stage) ? t(`stage_${lead.stage as (typeof STAGES)[number]}`) : (lead?.stage ?? null);

  return (
    <>
      <div className={HEAD_CLASS_NAME}>
        <div className={HEAD_TEXT_CLASS_NAME}><Heading level={2}>{t("customerTitle")}</Heading></div>
        <div className="xl:hidden">{closeButton}</div>
      </div>

      <section className={SIDE_SECTION_CLASS_NAME}>
        <div className={CUSTOMER_HEAD_CLASS_NAME}>
          <PersonAvatar name={name} size="lg" />
          <div className={HEAD_TEXT_CLASS_NAME}>
            <Text weight="semibold" overflow="truncate">{name}</Text>
            <Text size="sm" tone="muted">{conv.channel === "telegram" ? t("channelTelegramLine") : t("channelWebsiteLine")}</Text>
          </div>
        </div>
      </section>

      {escalation ? (
        <section className={ESCALATION_CLASS_NAME} aria-label={t("escalationTitle")}>
          <div className="flex items-center gap-2">
            <Badge tone="warning" isDot>{t("escalationTitle")}</Badge>
          </div>
          <div className="flex flex-col gap-1">
            <Text size="xs" tone="muted">{t("escalationAsked")}</Text>
            <div className={QUOTE_CLASS_NAME}><Text as="p" size="sm">{escalation.question}</Text></div>
            {escalation.staffName ? <Text size="xs" tone="muted">{t("escalationAssigned", { name: escalation.staffName })}</Text> : null}
          </div>
          <Textarea label={t("escalationDraft")} description={t("escalationDraftHint", { name: props.userName })} rows={4} value={draft} onValueChange={setDraft} />
          {notice ? <Alert tone={notice.tone} title={notice.tone === "negative" ? t("notSent") : t("escalationSent")} description={notice.tone === "negative" ? notice.text : undefined} /> : null}
          <div className={ACTIONS_CLASS_NAME}>
            <Button variant="primary" isPending={isSending} isDisabled={draft.trim().length === 0} onPress={() => void answer(draft)}>{t("escalationSend")}</Button>
            <Button variant="ghost" isDisabled={isSending} onPress={() => void answer(null)}>{t("escalationDecline")}</Button>
          </div>
        </section>
      ) : null}

      <section className={SIDE_SECTION_CLASS_NAME} aria-label={t("handlingTitle")}>
        <Text size="xs" tone="muted" weight="medium">{t("handlingTitle")}</Text>
        <Text size="sm">{conv.handledBy ? (mine ? t("handlingYou") : t("handlingOther", { name: conv.handledBy })) : t("handlingAi")}</Text>
        <div className={ACTIONS_CLASS_NAME}>
          {conv.handledBy === null ? (
            <Button variant="outline" isPending={props.isBusy} onPress={props.onTakeOver}>{t("takeOver")}</Button>
          ) : (
            <Button variant="outline" isPending={props.isBusy} onPress={props.onHandBack}>{t("handBack")}</Button>
          )}
        </div>
        {conv.handledBy === null ? <Text size="xs" tone="muted">{t("takeOverHint")}</Text> : null}
      </section>

      <section className={SIDE_SECTION_CLASS_NAME} aria-label={t("leadTitle")}>
        <Text size="xs" tone="muted" weight="medium">{t("leadTitle")}</Text>
        {lead ? (
          <>
            <Text weight="semibold">{lead.name}</Text>
            <div className={SIDE_FACTS_CLASS_NAME}>
              <Fact label={t("leadStage")} value={stage} />
              <Fact label={t("leadNeed")} value={lead.need || null} />
              <Fact label={t("leadPhone")} value={lead.phone} />
              <Fact label={t("leadEmail")} value={lead.email} />
            </div>
            <div className={ACTIONS_CLASS_NAME}>
              <Button variant="outline" size="sm" href={`/leads/${lead.id}`}>{t("leadOpen")}</Button>
            </div>
          </>
        ) : (
          <Text size="sm" tone="muted">{t("leadNone")}</Text>
        )}
      </section>
    </>
  );
};

