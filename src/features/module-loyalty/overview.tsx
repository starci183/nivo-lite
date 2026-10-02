"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Alert, Button, EmptyNotice, Progress, SurfaceCard, Text } from "@starci/grammar/common";
import { useLocale, useT } from "@/i18n/client";
import { loyalty } from "@/i18n/dict/loyalty";
import type { LoyaltyWorkbenchData } from "@/lib/module-loyalty-queries";
import { syncMembersAction } from "./actions";
import { BODY_CLASS_NAME, LINK_ROW_CLASS_NAME, LINK_VALUE_CLASS_NAME, OVERVIEW_GRID_CLASS_NAME, STAT_LINE_CLASS_NAME, TIER_ROW_CLASS_NAME } from "./classNames";
import { formatNumber } from "./format";

const StatLine = ({ label, value }: { readonly label: string; readonly value: string }) => (
  <div className={STAT_LINE_CLASS_NAME}>
    <Text size="sm">{label}</Text>
    <Text size="sm" weight="semibold">{value}</Text>
  </div>
);

/** The public check link with a copy button. */
const PublicLink = ({ slug, enabled }: { readonly slug: string; readonly enabled: boolean }) => {
  const t = useT(loyalty);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);
  const url = `${origin}/l/${slug}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className={BODY_CLASS_NAME}>
      <Text size="sm" tone="muted">{t("publicBody")}</Text>
      <div className={LINK_ROW_CLASS_NAME}>
        <code className={LINK_VALUE_CLASS_NAME}>{url}</code>
        <Button variant="outline" onPress={copy}>{copied ? t("copied") : t("copy")}</Button>
      </div>
      <Text size="xs" tone="muted" live="polite">{enabled ? (copied ? t("copiedNote") : t("publicOn")) : t("publicOff")}</Text>
    </div>
  );
};

/** Surface 1: what the programme holds, who is in which tier, and the public link. */
export const OverviewPanel = ({ data }: { readonly data: LoyaltyWorkbenchData }) => {
  const t = useT(loyalty);
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const s = data.stats;
  const maxCount = Math.max(1, ...s.tierCounts.map((x) => x.count));

  const sync = () => {
    setNote(null);
    startTransition(async () => {
      const r = await syncMembersAction();
      if (r.ok) {
        setNote({ ok: true, text: t("syncDone", { created: r.data.created, linked: r.data.linked }) });
        router.refresh();
      } else setNote({ ok: false, text: r.error });
    });
  };

  return (
    <>
      {s.members === 0 ? (
        <SurfaceCard ariaLabel={t("emptyMembersTitle")}>
          <EmptyNotice message={t("emptyMembersTitle")} description={data.canManage ? t("emptyMembersBody") : t("emptyMembersBodyStaff")} />
          {data.canManage ? (
            <div className={BODY_CLASS_NAME}>
              <div>
                <Button variant="primary" isPending={pending} onPress={sync}>{t("syncButton")}</Button>
              </div>
            </div>
          ) : null}
        </SurfaceCard>
      ) : null}
      <div aria-live="polite">
        {note ? <Alert title={note.ok ? t("syncOk") : t("syncFailed")} description={note.text} tone={note.ok ? "affirmative" : "negative"} /> : null}
      </div>

      <div className={OVERVIEW_GRID_CLASS_NAME}>
        <SurfaceCard label={t("tiersTitle")} headingLevel={2}>
          <div className={BODY_CLASS_NAME}>
            <Text size="sm" tone="muted">{t("tiersBody")}</Text>
            {s.tierCounts.map((x) => (
              <div key={x.key} className={TIER_ROW_CLASS_NAME}>
                <div className={STAT_LINE_CLASS_NAME}>
                  <Text size="sm" weight="medium">{x.name}</Text>
                  <Text size="sm" weight="semibold">{t("customers", { n: formatNumber(x.count, locale) })}</Text>
                </div>
                <Progress label={t("tierBarLabel", { name: x.name, n: x.count })} value={Math.round((x.count / maxCount) * 100)} />
              </div>
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard label={t("statsTitle")} headingLevel={2}>
          <div className={BODY_CLASS_NAME}>
            <StatLine label={t("statEarned")} value={t("points", { n: formatNumber(s.earned30d, locale) })} />
            <StatLine label={t("statExpired")} value={t("points", { n: formatNumber(s.expired30d, locale) })} />
            <StatLine label={t("statRedemptions")} value={String(s.redemptions30d)} />
            <StatLine label={t("statPromos")} value={String(s.promosSent30d)} />
            <StatLine label={t("statBirthdays")} value={String(s.birthdaysThisMonth)} />
          </div>
        </SurfaceCard>
      </div>

      <SurfaceCard label={t("publicTitle")} headingLevel={2}>
        <PublicLink slug={data.program.slug} enabled={data.program.enabled} />
      </SurfaceCard>
    </>
  );
};
