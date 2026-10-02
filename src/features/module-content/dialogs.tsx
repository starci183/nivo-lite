"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, Button, Checkbox, Dialog, Input, Select, Text, Textarea } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { content } from "@/i18n/dict/content";
import { channelRule, CONTENT_CHANNELS, pad2, type ContentChannel, type Pillar } from "@/lib/module-content-shared";
import { createItemAction, planMonthAction, quickDraftAction } from "./actions";
import { CHIPS_CLASS_NAME, FORM_CLASS_NAME, FORM_ROW_CLASS_NAME } from "./classNames";
import { toIso } from "./format";

type Note = { tone: "ok" | "error"; text: string } | null;
const NoteAlert = ({ note, onDismiss, label }: { readonly note: Note; readonly onDismiss: () => void; readonly label: string }) =>
  note ? <Alert title={note.text} tone={note.tone === "ok" ? "affirmative" : "negative"} dismissLabel={label} onDismiss={onDismiss} /> : null;

const monthOptions = (y: number, m: number): Array<{ id: string; label: string }> =>
  Array.from({ length: 4 }, (_, i) => {
    const t = new Date(Date.UTC(y, m - 1 + i, 1));
    return { id: `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}`, label: `${pad2(t.getUTCMonth() + 1)}/${t.getUTCFullYear()}` };
  });

export type PlanDialogProps = { readonly y: number; readonly m: number; readonly lastPlan: string | null; readonly onClose: () => void };

/** "Lên kế hoạch tháng": picks the month and waits for OpenClaw (one to two minutes), then shows how long it took. */
export const PlanDialog = ({ y, m, lastPlan, onClose }: PlanDialogProps) => {
  const t = useT(content);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [ym, setYm] = useState(`${y}-${pad2(m)}`);
  const [note, setNote] = useState<Note>(null);
  const run = () => {
    setNote(null);
    startTransition(async () => {
      const r = await planMonthAction(ym);
      if (r.ok) {
        setNote({ tone: "ok", text: `${t("planDone", { n: r.data.ideas, s: r.data.seconds })}${r.data.skippedPast ? ` ${t("planDonePast", { n: r.data.skippedPast })}` : ""}` });
        router.refresh();
      } else setNote({ tone: "error", text: t("actionFailed", { error: r.error }) });
    });
  };
  return (
    <Dialog isOpen onOpenChange={(o) => { if (!o && !isPending) onClose(); }} size="md" title={t("planTitle")} description={t("planBody")} closeLabel={t("close")} isDismissable={!isPending}
      footer={<><Button variant="outline" isDisabled={isPending} onPress={onClose}>{t("close")}</Button><Button variant="primary" isPending={isPending} onPress={run}>{t("planRun")}</Button></>}>
      <div className={FORM_CLASS_NAME}>
        <Select label={t("planMonthLabel")} options={monthOptions(y, m)} value={ym} isDisabled={isPending} onValueChange={(v) => v && setYm(v)} />
        {isPending ? <Text size="sm" live="polite">{t("planRunning")}</Text> : null}
        {lastPlan ? <Text size="xs" tone="muted">{lastPlan}</Text> : null}
        <NoteAlert note={note} onDismiss={() => setNote(null)} label={t("close")} />
      </div>
    </Dialog>
  );
};

/** "Ý tưởng nhanh": paste a topic, choose channels, get drafts. */
export const QuickDialog = ({ onClose, onOpenItem, defaultChannels }: { readonly onClose: () => void; readonly onOpenItem: (id: string) => void; readonly defaultChannels: ReadonlyArray<ContentChannel> }) => {
  const t = useT(content);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [topic, setTopic] = useState("");
  const [channels, setChannels] = useState<Array<ContentChannel>>(defaultChannels.length ? [...defaultChannels] : ["facebook"]);
  const [note, setNote] = useState<Note>(null);
  const run = () => {
    setNote(null);
    startTransition(async () => {
      const r = await quickDraftAction(topic, channels);
      if (r.ok) {
        router.refresh();
        onClose();
        onOpenItem(r.data.itemId);
      } else setNote({ tone: "error", text: t("actionFailed", { error: r.error }) });
    });
  };
  return (
    <Dialog isOpen onOpenChange={(o) => { if (!o && !isPending) onClose(); }} size="md" title={t("quickTitle")} description={t("quickBody")} closeLabel={t("close")} isDismissable={!isPending}
      footer={<><Button variant="outline" isDisabled={isPending} onPress={onClose}>{t("cancel")}</Button><Button variant="primary" isPending={isPending} isDisabled={topic.trim().length < 3 || channels.length === 0} onPress={run}>{t("quickRun")}</Button></>}>
      <div className={FORM_CLASS_NAME}>
        <Textarea label={t("quickTopic")} rows={4} value={topic} description={t("quickTopicHint")} isDisabled={isPending} onValueChange={setTopic} />
        <div className={CHIPS_CLASS_NAME} role="group" aria-label={t("quickChannels")}>
          {CONTENT_CHANNELS.map((c) => (
            <Checkbox key={c} label={channelRule(c).label} isSelected={channels.includes(c)} isDisabled={isPending} onSelectedChange={(on) => setChannels((cur) => (on ? [...cur, c] : cur.filter((x) => x !== c)))} />
          ))}
        </div>
        {isPending ? <Text size="sm" live="polite">{t("quickRunning")}</Text> : null}
        <NoteAlert note={note} onDismiss={() => setNote(null)} label={t("close")} />
      </div>
    </Dialog>
  );
};

/** "Thêm bài": a manual idea with an optional date. */
export const AddDialog = ({ pillars, onClose, onOpenItem }: { readonly pillars: ReadonlyArray<Pillar>; readonly onClose: () => void; readonly onOpenItem: (id: string) => void }) => {
  const t = useT(content);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("19:30");
  const [pillarId, setPillarId] = useState<string | null>(null);
  const [channels, setChannels] = useState<Array<ContentChannel>>(["facebook"]);
  const [note, setNote] = useState<Note>(null);
  const run = () => {
    const at = toIso(date, time, "19:30");
    if (at === "invalid_date") { setNote({ tone: "error", text: t("dateInvalid") }); return; }
    if (at === "invalid_time") { setNote({ tone: "error", text: t("timeInvalid") }); return; }
    setNote(null);
    startTransition(async () => {
      const r = await createItemAction({ title, scheduledAt: at, channels, pillarId });
      if (r.ok) { router.refresh(); onClose(); onOpenItem(r.data.id); } else setNote({ tone: "error", text: t("actionFailed", { error: r.error }) });
    });
  };
  return (
    <Dialog isOpen onOpenChange={(o) => { if (!o && !isPending) onClose(); }} size="md" title={t("addTitle")} closeLabel={t("close")}
      footer={<><Button variant="outline" isDisabled={isPending} onPress={onClose}>{t("cancel")}</Button><Button variant="primary" isPending={isPending} isDisabled={!title.trim() || channels.length === 0} onPress={run}>{t("addRun")}</Button></>}>
      <div className={FORM_CLASS_NAME}>
        <Input id="add-title" name="title" label={t("addFieldTitle")} variant="secondary" value={title} isDisabled={isPending} onValueChange={setTitle} />
        <div className={FORM_ROW_CLASS_NAME}>
          <Input id="add-date" name="date" label={t("addDate")} variant="secondary" value={date} hint={t("addDateHint")} isDisabled={isPending} onValueChange={setDate} />
          <Input id="add-time" name="time" label={t("addTime")} variant="secondary" value={time} hint={t("addTimeHint")} isDisabled={isPending} onValueChange={setTime} />
        </div>
        {pillars.length ? <Select label={t("fieldPillar")} options={[{ id: "", label: t("noPillar") }, ...pillars.filter((p) => p.active).map((p) => ({ id: p.id, label: p.name }))]} value={pillarId ?? ""} isDisabled={isPending} onValueChange={(v) => setPillarId(v || null)} /> : null}
        <div className={CHIPS_CLASS_NAME} role="group" aria-label={t("fieldChannels")}>
          {CONTENT_CHANNELS.map((c) => (
            <Checkbox key={c} label={channelRule(c).label} isSelected={channels.includes(c)} isDisabled={isPending} onSelectedChange={(on) => setChannels((cur) => (on ? [...cur, c] : cur.filter((x) => x !== c)))} />
          ))}
        </div>
        <NoteAlert note={note} onDismiss={() => setNote(null)} label={t("close")} />
      </div>
    </Dialog>
  );
};
