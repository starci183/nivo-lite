"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Alert, Badge, Button, EmptyNotice, Input, SurfaceCard, Text, Textarea, type BadgeTone } from "@starci/grammar/common";
import { useLocale, useT } from "@/i18n/client";
import { loyalty } from "@/i18n/dict/loyalty";
import type { MemberDetail } from "@/lib/module-loyalty-queries";
import { displayPhone, formatVndShort, type LedgerKind, type LoyaltyConfig } from "@/lib/module-loyalty-shared";
import { adjustPointsAction, loadMemberAction, redeemForMemberAction, updateMemberAction } from "./actions";
import { BODY_CLASS_NAME, CHIPS_CLASS_NAME, FORM_CLASS_NAME, LEDGER_ITEM_CLASS_NAME, LIST_CLASS_NAME, REWARD_LINE_CLASS_NAME } from "./classNames";
import { formatDate, formatDateTime, formatNumber, parseSigned } from "./format";
import { tierTone } from "./tier";

const KIND_TONE: Record<LedgerKind, BadgeTone> = { earn: "success", redeem: "accent", expire: "warning", adjust: "neutral" };

/** "1990-05-17" to "17/05/1990". */
const isoToInput = (iso: string | null): string => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");

/** "17/05/1990" to "1990-05-17"; empty is null (no birthday), an impossible date is undefined. */
const inputToIso = (v: string): string | null | undefined => {
  const s = v.trim();
  if (!s) return null;
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (!m) return undefined;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d || y < 1900 || date.getTime() > Date.now()) return undefined;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};

type Note = { readonly ok: boolean; readonly text: string };

const Notice = ({ note }: { readonly note: Note | null }) => (
  <div aria-live="polite">{note ? <Text size="sm" weight="medium">{note.text}</Text> : null}</div>
);

/** The edit form (managers): name, birthday, note. */
const EditForm = ({ detail, onSaved }: { readonly detail: MemberDetail; readonly onSaved: () => void }) => {
  const t = useT(loyalty);
  const m = detail.member;
  const [name, setName] = useState(m.name);
  const [birthday, setBirthday] = useState(isoToInput(m.birthday));
  const [note, setNote] = useState(m.note);
  const [result, setResult] = useState<Note | null>(null);
  const [pending, startTransition] = useTransition();
  const iso = inputToIso(birthday);

  const save = () => {
    setResult(null);
    if (!name.trim()) return setResult({ ok: false, text: t("nameRequired") });
    if (iso === undefined) return setResult({ ok: false, text: t("birthdayInvalid") });
    startTransition(async () => {
      const r = await updateMemberAction(m.id, { name: name.trim(), birthday: iso, note: note.trim() });
      setResult(r.ok ? { ok: true, text: t("saved") } : { ok: false, text: r.error });
      if (r.ok) onSaved();
    });
  };

  return (
    <div className={FORM_CLASS_NAME}>
      <Input id={`member-name-${m.id}`} name="name" label={t("fieldName")} variant="secondary" value={name} isRequired isDisabled={pending} onValueChange={(v) => setName(v.slice(0, 80))} />
      <Input id={`member-birthday-${m.id}`} name="birthday" label={t("fieldBirthday")} variant="secondary" placeholder={t("birthdayPlaceholder")} hint={t("birthdayHint")} value={birthday} isError={iso === undefined} errorMessage={iso === undefined ? t("birthdayInvalid") : undefined} isDisabled={pending} onValueChange={(v) => setBirthday(v.slice(0, 10))} />
      <Textarea label={t("fieldNote")} rows={2} maxLength={300} value={note} isDisabled={pending} onValueChange={setNote} />
      <div>
        <Button variant="secondary" isPending={pending} onPress={save}>{t("save")}</Button>
      </div>
      <Notice note={result} />
    </div>
  );
};

/** "Điều chỉnh điểm": a signed number and a required reason; the answer says whether it was recorded or is waiting. */
const AdjustForm = ({ detail, onDone }: { readonly detail: MemberDetail; readonly onDone: () => void }) => {
  const t = useT(loyalty);
  const [points, setPoints] = useState("");
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<Note | null>(null);
  const [pending, startTransition] = useTransition();
  const n = parseSigned(points);
  const invalid = points !== "" && (n === null || n === 0);

  const submit = () => {
    setResult(null);
    if (n === null || n === 0) return setResult({ ok: false, text: t("adjustPointsInvalid") });
    if (!reason.trim()) return setResult({ ok: false, text: t("adjustReasonRequired") });
    startTransition(async () => {
      const r = await adjustPointsAction(detail.member.id, n, reason.trim());
      if (r.ok) {
        setResult({ ok: true, text: r.data.state === "done" ? t("adjustDone") : t("adjustWaiting") });
        setPoints("");
        setReason("");
        onDone();
      } else setResult({ ok: false, text: r.error });
    });
  };

  return (
    <div className={FORM_CLASS_NAME}>
      <Input id={`adjust-points-${detail.member.id}`} name="points" label={t("adjustPoints")} variant="secondary" hint={t("adjustPointsHint")} placeholder="+50" value={points} isError={invalid} errorMessage={invalid ? t("adjustPointsInvalid") : undefined} isDisabled={pending} onValueChange={(v) => setPoints(v.replace(/[^\d+\-\s]/g, "").slice(0, 8))} />
      <Input id={`adjust-reason-${detail.member.id}`} name="reason" label={t("adjustReason")} variant="secondary" isRequired value={reason} isDisabled={pending} onValueChange={(v) => setReason(v.slice(0, 300))} />
      <div>
        <Button variant="secondary" isPending={pending} isDisabled={n === null || n === 0 || !reason.trim()} onPress={submit}>{t("adjustSubmit")}</Button>
      </div>
      <Notice note={result} />
    </div>
  );
};

/** The member's detail: header, edit, point adjustment, rewards they can redeem now and the ledger timeline. */
export const MemberDetailPanel = ({ id, config, canManage, nowIso, onClose }: {
  readonly id: string; readonly config: LoyaltyConfig; readonly canManage: boolean; readonly nowIso: string; readonly onClose: () => void;
}) => {
  const t = useT(loyalty);
  const locale = useLocale();
  const router = useRouter();
  const [detail, setDetail] = useState<MemberDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [redeemNote, setRedeemNote] = useState<(Note & { rewardId: string }) | null>(null);
  const [busyReward, setBusyReward] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const load = useCallback(async () => {
    const r = await loadMemberAction(id);
    if (r.ok) {
      setDetail(r.data);
      setError(null);
    } else setError(r.error);
  }, [id]);

  useEffect(() => {
    let live = true;
    void loadMemberAction(id).then((r) => {
      if (!live) return;
      if (r.ok) setDetail(r.data);
      else setError(r.error);
    });
    return () => {
      live = false;
    };
  }, [id]);

  const changed = useCallback(() => {
    void load();
    router.refresh();
  }, [load, router]);

  const redeem = (rewardId: string) => {
    setRedeemNote(null);
    setBusyReward(rewardId);
    startTransition(async () => {
      const r = await redeemForMemberAction(id, rewardId);
      if (r.ok) setRedeemNote({ rewardId, ok: r.data.state !== "failed", text: r.data.state === "waiting" ? `${t("redeemWaiting")} ${r.data.summary}` : r.data.summary });
      else setRedeemNote({ rewardId, ok: false, text: r.error });
      setBusyReward(null);
      changed();
    });
  };

  if (error && !detail) {
    return (
      <SurfaceCard ariaLabel={t("detailFailed")}>
        <Alert title={t("detailFailed")} description={error} tone="negative" />
      </SurfaceCard>
    );
  }
  if (!detail) {
    return (
      <SurfaceCard ariaLabel={t("loading")}>
        <div className={BODY_CLASS_NAME}><Text size="sm" tone="muted" live="polite">{t("loading")}</Text></div>
      </SurfaceCard>
    );
  }

  const m = detail.member;
  const pts = (n: number) => t("points", { n: formatNumber(n, locale) });

  return (
    <div className={FORM_CLASS_NAME}>
      <SurfaceCard label={m.name} headingLevel={2} labelEnd={<Button variant="ghost" size="sm" onPress={onClose}>{t("close")}</Button>}>
        <div className={BODY_CLASS_NAME}>
          <div className={CHIPS_CLASS_NAME}>
            {detail.tierName ? <Badge tone={tierTone(config, m.tierKey)}>{detail.tierName}</Badge> : null}
            <Text as="span" size="md" weight="semibold">{pts(m.points)}</Text>
          </div>
          <Text size="sm" tone="muted">{[displayPhone(m.phone), m.email].filter(Boolean).join(" · ") || t("noPhone")}</Text>
          <Text size="sm">{t("spentTotal", { value: formatVndShort(m.lifetimeSpendVnd) })} · {t("visitsCount", { n: m.visits })}</Text>
          <Text size="sm" tone="muted">{t("joinedAt", { date: formatDate(m.joinedAt, locale) })}</Text>
          {detail.nextTier ? <Text size="sm">{t("nextTier", { name: detail.nextTier.name, value: formatVndShort(detail.nextTier.missingVnd) })}</Text> : <Text size="sm">{t("topTier")}</Text>}
          {detail.expiring.points > 0 ? (
            <Text size="sm" weight="medium">{t("expiringSoon", { points: pts(detail.expiring.points), date: detail.expiring.firstAt ? formatDate(detail.expiring.firstAt, locale) : "" })}</Text>
          ) : null}
        </div>
      </SurfaceCard>

      <SurfaceCard label={t("editTitle")} headingLevel={3}>
        <div className={BODY_CLASS_NAME}>
          {canManage ? <EditForm key={`${m.id}-${m.name}-${m.birthday}-${m.note}`} detail={detail} onSaved={changed} /> : (
            <>
              <Text size="sm">{t("fieldBirthday")}: {m.birthday ? formatDate(m.birthday, locale) : t("none")}</Text>
              <Text size="sm">{t("fieldNote")}: {m.note || t("none")}</Text>
              <Text size="xs" tone="muted">{t("readOnlyNote")}</Text>
            </>
          )}
        </div>
      </SurfaceCard>

      <SurfaceCard label={t("adjustTitle")} headingLevel={3}>
        <div className={BODY_CLASS_NAME}>
          <Text size="sm" tone="muted">{t("adjustBody")}</Text>
          <AdjustForm detail={detail} onDone={changed} />
        </div>
      </SurfaceCard>

      <SurfaceCard label={t("redeemTitle")} headingLevel={3}>
        <div className={BODY_CLASS_NAME}>
          {detail.rewards.length === 0 ? <Text size="sm" tone="muted">{t("redeemEmpty")}</Text> : null}
          {detail.rewards.map(({ reward, block }) => (
            <div key={reward.id} className={REWARD_LINE_CLASS_NAME}>
              <div>
                <Text weight="medium">{reward.name}</Text>
                <Text size="sm" tone="muted">{pts(reward.pointsCost)}{reward.valueVnd > 0 ? ` · ${formatVndShort(reward.valueVnd)}` : ""}</Text>
                {block ? <Text size="sm">{block}</Text> : null}
                {redeemNote && redeemNote.rewardId === reward.id ? <Text size="sm" weight="medium" live="polite">{redeemNote.text}</Text> : null}
              </div>
              {!block ? <Button variant="primary" size="sm" isPending={busyReward === reward.id} isDisabled={busyReward !== null} onPress={() => redeem(reward.id)}>{t("redeemButton")}</Button> : null}
            </div>
          ))}
        </div>
      </SurfaceCard>

      <SurfaceCard label={t("ledgerTitle")} headingLevel={3}>
        <div className={BODY_CLASS_NAME}>
          {detail.ledger.length === 0 ? <EmptyNotice message={t("ledgerEmpty")} /> : (
            <ul className={LIST_CLASS_NAME}>
              {detail.ledger.map((row) => (
                <li key={row.id} className={LEDGER_ITEM_CLASS_NAME}>
                  <div className={CHIPS_CLASS_NAME}>
                    <Badge tone={KIND_TONE[row.kind]}>{t(`kind_${row.kind}`)}</Badge>
                    <Text as="span" weight="semibold">{row.points > 0 ? "+" : ""}{pts(row.points)}</Text>
                    {row.amountVnd ? <Text as="span" size="sm" tone="muted">{formatVndShort(row.amountVnd)}</Text> : null}
                  </div>
                  <Text size="xs" tone="muted">{formatDateTime(row.occurredAt, locale)} · {t("ledgerBy", { who: row.by || "-" })}</Text>
                  {row.ref ? <Text size="sm">{row.ref}</Text> : null}
                  {row.evidence ? <Text size="xs" tone="muted">{t("ledgerEvidence", { text: row.evidence })}</Text> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </SurfaceCard>
      <Text size="xs" tone="muted">{t("asOf", { date: formatDateTime(nowIso, locale) })}</Text>
    </div>
  );
};
