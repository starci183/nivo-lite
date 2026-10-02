"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Alert, Badge, Button, CheckboxGroup, Checkbox, EmptyNotice, Input, SurfaceCard, Text, Textarea, type BadgeTone } from "@starci/grammar/common";
import { useLocale, useT } from "@/i18n/client";
import { loyalty } from "@/i18n/dict/loyalty";
import type { LoyaltyWorkbenchData } from "@/lib/module-loyalty-queries";
import type { SegmentPreview } from "@/lib/module-loyalty-promo";
import { segmentLabel, type Segment } from "@/lib/module-loyalty-shared";
import { createCampaignAction, previewSegmentAction } from "./actions";
import { BODY_CLASS_NAME, CHECKS_CLASS_NAME, CHIPS_CLASS_NAME, FIELD_PAIR_CLASS_NAME, FORM_CLASS_NAME, LIST_CLASS_NAME, QUOTE_CLASS_NAME, RESULT_CLASS_NAME, ROW_CLASS_NAME, ROW_MAIN_CLASS_NAME } from "./classNames";
import { formatDateTime, formatNumber, parseDigits } from "./format";

const STATUS_TONE: Record<string, BadgeTone> = { waiting: "warning", sending: "accent", done: "success", failed: "danger", rejected: "neutral" };
const KNOWN_REASONS = ["quota", "engine_offline", "timeout", "error", "not_configured", "unusable"] as const;
const statusKey = (status: string): "campaignStatus_waiting" | "campaignStatus_sending" | "campaignStatus_done" | "campaignStatus_failed" | "campaignStatus_rejected" => {
  if (status === "sending" || status === "done" || status === "failed" || status === "rejected") return `campaignStatus_${status}`;
  return "campaignStatus_waiting";
};
const isWaiting = (status: string): boolean => status === "waiting" || status === "waiting_decision";

type Created = { status: string; recipients: number; draft: string; generated: boolean; draftMs: number; reason: string | null };

const digitsOnly = (v: string): string => v.replace(/[^\d]/g, "").slice(0, 10);

/** Surface 4: build a segment, see how many customers match, let OpenClaw draft the message and send it for approval. Managers only. */
export const PromoPanel = ({ data }: { readonly data: LoyaltyWorkbenchData }) => {
  const t = useT(loyalty);
  const locale = useLocale();
  const router = useRouter();
  const cfg = data.program.config;
  const [tiers, setTiers] = useState<Array<string>>([]);
  const [inactive, setInactive] = useState("");
  const [birthday, setBirthday] = useState(false);
  const [minSpend, setMinSpend] = useState("");
  const [name, setName] = useState("");
  const [brief, setBrief] = useState("");
  const [preview, setPreview] = useState<SegmentPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ticket = useRef(0);

  const segment = useMemo<Segment>(() => {
    const out: { tiers?: Array<string>; inactiveDays?: number; birthdayThisMonth?: boolean; minSpendVnd?: number } = {};
    if (tiers.length) out.tiers = tiers;
    const d = parseDigits(inactive);
    if (d) out.inactiveDays = d;
    if (birthday) out.birthdayThisMonth = true;
    const s = parseDigits(minSpend);
    if (s) out.minSpendVnd = s;
    return out;
  }, [tiers, inactive, birthday, minSpend]);

  // Live count, debounced; an older answer never overwrites a newer one.
  useEffect(() => {
    if (!data.canManage) return;
    const mine = ++ticket.current;
    setPreviewing(true);
    const timer = setTimeout(() => {
      void previewSegmentAction(segment).then((r) => {
        if (mine !== ticket.current) return;
        setPreviewing(false);
        if (r.ok) {
          setPreview(r.data);
          setPreviewError(null);
        } else setPreviewError(r.error);
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [segment, data.canManage]);

  const submit = () => {
    setError(null);
    setCreated(null);
    if (!brief.trim()) return setError(t("briefRequired"));
    startTransition(async () => {
      const r = await createCampaignAction({ name: name.trim() || segmentLabel(cfg, segment), segment, brief: brief.trim() });
      if (r.ok) {
        setCreated(r.data);
        setBrief("");
        setName("");
        router.refresh();
      } else setError(r.error);
    });
  };

  const reasonText = (reason: string | null): string => {
    const known = KNOWN_REASONS.find((x) => x === reason);
    return t(`reason_${known ?? "error"}`);
  };

  return (
    <>
      {data.canManage ? (
        <SurfaceCard label={t("promoTitle")} headingLevel={2}>
          <div className={BODY_CLASS_NAME}>
            <Text size="sm" tone="muted">{t("promoBody")}</Text>
            <div className={FORM_CLASS_NAME}>
              <CheckboxGroup label={t("segTiers")} description={t("segTiersHint")} orientation="horizontal" options={cfg.tiers.map((x) => ({ value: x.key, label: x.name }))} value={tiers} isDisabled={pending} onValueChange={setTiers} />
              <div className={FIELD_PAIR_CLASS_NAME}>
                <Input id="seg-inactive" name="inactive" label={t("segInactive")} variant="secondary" hint={t("segInactiveHint")} placeholder="45" value={inactive} isDisabled={pending} onValueChange={(v) => setInactive(digitsOnly(v).slice(0, 4))} />
                <Input id="seg-spend" name="spend" label={t("segSpend")} variant="secondary" hint={t("segSpendHint")} placeholder="1000000" value={minSpend} isDisabled={pending} onValueChange={(v) => setMinSpend(digitsOnly(v))} />
              </div>
              <div className={CHECKS_CLASS_NAME}>
                <Checkbox label={t("segBirthday")} isSelected={birthday} isDisabled={pending} onSelectedChange={setBirthday} />
              </div>
            </div>

            <div className={RESULT_CLASS_NAME} aria-live="polite">
              {previewError ? <Text size="sm">{previewError}</Text> : previewing && !preview ? <Text size="sm" tone="muted">{t("previewLoading")}</Text> : preview ? (
                <>
                  <Text weight="semibold">{t("previewCount", { total: formatNumber(preview.total, locale), reachable: formatNumber(preview.reachable, locale) })}</Text>
                  <Text size="xs" tone="muted">{t("previewWho", { who: segmentLabel(cfg, segment) })}</Text>
                  {preview.sample.length > 0 ? <Text size="xs" tone="muted">{t("previewSample", { names: preview.sample.map((s) => s.name).join(", ") })}</Text> : null}
                </>
              ) : null}
            </div>

            <div className={FORM_CLASS_NAME}>
              <Input id="promo-name" name="name" label={t("campaignName")} variant="secondary" hint={t("campaignNameHint")} value={name} isDisabled={pending} onValueChange={(v) => setName(v.slice(0, 80))} />
              <Textarea label={t("brief")} description={t("briefHint")} rows={4} maxLength={500} value={brief} isRequired isDisabled={pending} onValueChange={setBrief} />
              <div>
                <Button variant="primary" isPending={pending} isDisabled={!brief.trim() || (preview !== null && preview.total === 0)} onPress={submit}>{t("submitCampaign")}</Button>
              </div>
              {pending ? <Text size="sm" tone="muted" live="polite">{t("drafting")}</Text> : null}
            </div>

            <div aria-live="polite">
              {error ? <Alert title={t("campaignFailed")} description={error} tone="negative" /> : null}
              {created ? (
                <div className={RESULT_CLASS_NAME}>
                  <Text weight="semibold">
                    {isWaiting(created.status)
                      ? (created.generated ? t("createdWaiting", { s: Math.max(1, Math.round(created.draftMs / 1000)) }) : t("createdWaitingTemplate"))
                      : t("createdSending")}
                  </Text>
                  <Text size="sm">{t("createdRecipients", { n: created.recipients })}</Text>
                  <div className={CHIPS_CLASS_NAME}>
                    <Badge tone={created.generated ? "success" : "warning"}>{created.generated ? t("draftByOpenClaw") : t("draftByTemplate")}</Badge>
                    <Text as="span" size="xs" tone="muted">{t("draftTime", { s: (created.draftMs / 1000).toFixed(1) })}</Text>
                  </div>
                  {!created.generated ? <Text size="sm">{t("templateReason", { reason: reasonText(created.reason) })}</Text> : null}
                  <div className={QUOTE_CLASS_NAME}>
                    <Text size="xs" tone="muted" weight="medium">{t("draftLabel")}</Text>
                    <Text as="p" size="sm">{created.draft}</Text>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </SurfaceCard>
      ) : (
        <SurfaceCard ariaLabel={t("promoTitle")}>
          <EmptyNotice message={t("promoManagersOnly")} description={t("promoManagersOnlyBody")} />
        </SurfaceCard>
      )}

      <SurfaceCard label={t("campaignsTitle")} headingLevel={2}>
        {data.campaigns.length === 0 ? (
          <EmptyNotice message={t("campaignsEmptyTitle")} description={t("campaignsEmptyBody")} />
        ) : (
          <ul className={LIST_CLASS_NAME}>
            {data.campaigns.map((c) => (
              <li key={c.id} className={ROW_CLASS_NAME}>
                <div className={ROW_MAIN_CLASS_NAME}>
                  <div className={CHIPS_CLASS_NAME}>
                    <Text as="span" weight="semibold">{c.name}</Text>
                    <Badge tone={STATUS_TONE[c.status] ?? "neutral"}>{t(statusKey(c.status))}</Badge>
                  </div>
                  <Text size="sm" tone="muted">{t("campaignRecipients", { n: c.recipients })} · {t("campaignCounts", { sent: c.sent, queued: c.queued, failed: c.failed, skipped: c.skipped })}</Text>
                  <Text size="xs" tone="muted">{t("campaignMeta", { who: c.createdBy || "-", date: formatDateTime(c.createdAt, locale) })}</Text>
                  {c.draft ? (
                    <div className={QUOTE_CLASS_NAME}>
                      <Text size="xs" tone="muted" weight="medium">{t("draftLabel")}</Text>
                      <Text as="p" size="sm">{c.draft}</Text>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SurfaceCard>
    </>
  );
};
