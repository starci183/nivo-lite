"use client";

import { useEffect, useState } from "react";
import { Alert, SurfaceCard, Text, TextAction } from "@starci/grammar/common";
import { AutomationsBoard } from "@/features/automations/AutomationsBoard";
import type { AutomationsData } from "@/features/automations/useAutomations";
import { useT } from "@/i18n/client";
import { automations as dict } from "@/i18n/dict/automations";
import { refreshAutomations } from "@/lib/automation-actions";
import type { ModuleScope } from "@/lib/automation-shared";
import { STACK_CLASS_NAME } from "./classNames";

type ModuleAutomationsProps = { readonly moduleKey: ModuleScope; readonly canEdit: boolean };

/** "Tự động hoá của module": this module's automations as a compact list. Loads its own data, so the Settings page stays as it is. Owner and manager only. */
export const ModuleAutomations = ({ moduleKey, canEdit }: ModuleAutomationsProps) => {
  const t = useT(dict);
  const [data, setData] = useState<AutomationsData | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!canEdit) return;
    let live = true;
    void refreshAutomations().then((r) => {
      if (!live) return;
      if (r.ok) { setData(r.data); setFailed(false); } else setFailed(true);
    });
    return () => { live = false; };
  }, [canEdit, attempt]);

  if (!canEdit) return null;
  return (
    <SurfaceCard label={t("moduleTitle")} headingLevel={2} labelEnd={<TextAction href="/automations" size="sm" appearance="inline">{t("seeAll")}</TextAction>}>
      <div className={STACK_CLASS_NAME}>
        <Text size="sm" tone="muted">{t("moduleHelp")}</Text>
        {failed ? (
          <Alert tone="negative" title={t("loadFailed")} action={{ label: t("retry"), onAction: () => { setFailed(false); setAttempt((n) => n + 1); } }} />
        ) : data === null ? <Text size="sm" tone="muted" live="polite">{t("loading")}</Text> : <AutomationsBoard initial={data} layout="module" moduleKey={moduleKey} />}
      </div>
    </SurfaceCard>
  );
};
