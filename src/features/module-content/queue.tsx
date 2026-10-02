"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, Button, EmptyNotice, SectionHeader, SurfaceCard, Text } from "@starci/grammar/common";
import { canDecideItem, useMember } from "@/features/shell/member-context";
import { useT } from "@/i18n/client";
import { content } from "@/i18n/dict/content";
import { decideWorkItem } from "@/lib/flow-actions";
import { channelRule, copyText, type ContentItem } from "@/lib/module-content-shared";
import { CHIPS_CLASS_NAME, LIST_CLASS_NAME, QUOTE_CLASS_NAME, ROW_ACTIONS_CLASS_NAME, ROW_CLASS_NAME, ROW_MAIN_CLASS_NAME } from "./classNames";
import { dateText, timeText } from "./format";
import { ChannelBadges } from "./parts";

export type QueuePanelProps = {
  readonly waiting: ReadonlyArray<ContentItem>;
  readonly ready: ReadonlyArray<ContentItem>;
  readonly onOpen: (id: string) => void;
};

const QueueCard = ({ item, onOpen }: { readonly item: ContentItem; readonly onOpen: (id: string) => void }) => {
  const t = useT(content);
  const router = useRouter();
  const me = useMember();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"approved" | "rejected" | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const canAct = canDecideItem(me, null);

  const decide = (decision: "approved" | "rejected") => {
    if (!item.work_item_id) return;
    setBusy(decision);
    setMessage(null);
    startTransition(async () => {
      const r = await Promise.resolve(decideWorkItem(item.work_item_id as string, decision)).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "" }));
      if (r.ok) {
        setMessage({ tone: "ok", text: decision === "approved" ? t("queueApproved") : t("queueRejected") });
        router.refresh();
      } else setMessage({ tone: "error", text: t("actionFailed", { error: r.error }) });
      setBusy(null);
    });
  };

  return (
    <li className={ROW_CLASS_NAME}>
      <div className={ROW_MAIN_CLASS_NAME}>
        <Text size="xs" tone="muted">{item.scheduled_at ? `${dateText(item.scheduled_at)} · ${timeText(item.scheduled_at)}` : t("noDate")}</Text>
        <Text weight="semibold">{item.title}</Text>
        <div className={CHIPS_CLASS_NAME}><ChannelBadges channels={item.channels} /></div>
        {item.channels.map((c) => (
          <div key={c} className={QUOTE_CLASS_NAME}>
            <Text size="xs" tone="muted" weight="medium">{channelRule(c).label}</Text>
            <Text as="p" size="sm">{copyText(item.variants[c])}</Text>
          </div>
        ))}
        {!item.work_item_id ? <Text size="sm" tone="muted">{t("queueNoDecision")}</Text> : null}
        {message ? <Text size="sm" live={message.tone === "error" ? "assertive" : "polite"}>{message.text}</Text> : null}
      </div>
      <div className={ROW_ACTIONS_CLASS_NAME}>
        {canAct && item.work_item_id ? (
          <>
            <Button variant="primary" size="sm" isPending={isPending && busy === "approved"} isDisabled={isPending} onPress={() => decide("approved")}>{t("approve")}</Button>
            <Button variant="danger-soft" size="sm" isPending={isPending && busy === "rejected"} isDisabled={isPending} onPress={() => decide("rejected")}>{t("reject")}</Button>
          </>
        ) : null}
        <Button variant="outline" size="sm" onPress={() => onOpen(item.id)}>{t("queueOpen")}</Button>
      </div>
    </li>
  );
};

/** Posts waiting for the owner's decision (the publish_post gate), then the approved ones that are ready to post. */
export const QueuePanel = ({ waiting, ready, onOpen }: QueuePanelProps) => {
  const t = useT(content);
  return (
    <>
      <Alert title={t("queueWhy")} tone="informative" />
      <SurfaceCard ariaLabel={t("tabQueue")}>
        {waiting.length === 0 ? <EmptyNotice message={t("queueEmptyTitle")} description={t("queueEmptyBody")} /> : (
          <ul className={LIST_CLASS_NAME}>{waiting.map((i) => <QueueCard key={i.id} item={i} onOpen={onOpen} />)}</ul>
        )}
      </SurfaceCard>
      {ready.length ? (
        <>
          <SectionHeader level={2} title={t("readyTitle")} />
          <SurfaceCard ariaLabel={t("readyTitle")}>
            <ul className={LIST_CLASS_NAME}>
              {ready.map((i) => (
                <li key={i.id} className={ROW_CLASS_NAME}>
                  <div className={ROW_MAIN_CLASS_NAME}>
                    <Text size="xs" tone="muted">{i.scheduled_at ? `${dateText(i.scheduled_at)} · ${timeText(i.scheduled_at)}` : t("noDate")}</Text>
                    <Text weight="semibold">{i.title}</Text>
                    <div className={CHIPS_CLASS_NAME}><ChannelBadges channels={i.channels} />{i.approved_by ? <Text as="span" size="xs" tone="muted">{t("approvedBy", { who: i.approved_by })}</Text> : null}</div>
                  </div>
                  <div className={ROW_ACTIONS_CLASS_NAME}><Button variant="primary" size="sm" onPress={() => onOpen(i.id)}>{t("postedTitle")}</Button></div>
                </li>
              ))}
            </ul>
          </SurfaceCard>
        </>
      ) : null}
    </>
  );
};
