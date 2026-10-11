"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Alert, DescriptionList, EmptyNotice, Input, Meter, SurfaceCard, Text } from "@starci/grammar/common";
import { useLocale, useT } from "@/i18n/client";
import { loyalty } from "@/i18n/dict/loyalty";
import type { LoyaltyWorkbenchData } from "@/lib/module-loyalty-queries";
import { syncMembersAction } from "./actions";
import { BODY_CLASS_NAME, OVERVIEW_GRID_CLASS_NAME } from "./classNames";
import { formatNumber } from "./format";

/** The public check link with a copy button. */
const PublicLink = ({ slug, enabled }: { readonly slug: string; readonly enabled: boolean }) => {
  const t = useT(loyalty);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);
  const url = `${origin}/l/${slug}`;
  return (
    <div className={BODY_CLASS_NAME}>
      <Text size="sm" tone="muted">{t("publicBody")}</Text>
      <Input
        id="loyalty-public-link" name="publicLink" label={t("publicTitle")} variant="secondary" value={url} isReadOnly
        isCopyable copyLabel={t("copy")} copiedLabel={t("copied")} onCopy={() => setCopied(true)}
      />
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
          <EmptyNotice
            message={t("emptyMembersTitle")} description={data.canManage ? t("emptyMembersBody") : t("emptyMembersBodyStaff")}
            {...(data.canManage ? { actionLabel: t("syncButton"), actionVariant: "primary" as const, isActionPending: pending, onAction: sync } : {})}
          />
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
              <Meter key={x.key} label={x.name} value={x.count} maxValue={maxCount} valueLabel={t("customers", { n: formatNumber(x.count, locale) })} />
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard label={t("statsTitle")} headingLevel={2}>
          <DescriptionList
            layout="columns"
            isDivided
            items={[
              { id: "earned", term: t("statEarned"), description: t("points", { n: formatNumber(s.earned30d, locale) }) },
              { id: "expired", term: t("statExpired"), description: t("points", { n: formatNumber(s.expired30d, locale) }) },
              { id: "redemptions", term: t("statRedemptions"), description: String(s.redemptions30d) },
              { id: "promos", term: t("statPromos"), description: String(s.promosSent30d) },
              { id: "birthdays", term: t("statBirthdays"), description: String(s.birthdaysThisMonth) },
            ]}
          />
        </SurfaceCard>
      </div>

      <SurfaceCard label={t("publicTitle")} headingLevel={2}>
        <PublicLink slug={data.program.slug} enabled={data.program.enabled} />
      </SurfaceCard>
    </>
  );
};
