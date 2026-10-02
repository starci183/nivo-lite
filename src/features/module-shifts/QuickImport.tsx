"use client";

import { useMemo, useState, useTransition } from "react";
import { Alert, Button, SurfaceCard, Text, Textarea } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { shifts as dict } from "@/i18n/dict/shifts";
import { parseImport } from "@/lib/module-shifts-import";
import type { BenchData } from "@/lib/module-shifts-view";
import { importQuickAction } from "./actions";
import { BLOCK_CLASS_NAME, PANEL_CLASS_NAME, ROW_CLASS_NAME } from "./classNames";

type Props = { readonly data: BenchData; readonly onReload: () => Promise<void> };

/** Nhập nhanh: type positions, staff and coverage as plain lines, preview what will be created, create it in one go. */
export const QuickImport = ({ data, onReload }: Props) => {
  const t = useT(dict);
  const [pending, start] = useTransition();
  const [positions, setPositions] = useState("");
  const [staff, setStaff] = useState("");
  const [coverage, setCoverage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const parsed = useMemo(() => parseImport({ positions, staff, coverage }, data.setup.positions.map((p) => p.name)), [positions, staff, coverage, data.setup.positions]);
  const empty = !parsed.positions.length && !parsed.staff.length && !parsed.blocks.length;

  const create = () => start(async () => {
    setError(null); setDone(null);
    const r = await importQuickAction({ positions, staff, coverage });
    if (!r.ok) { setError(r.error); return; }
    setDone(t("importDone", { p: r.data.positions, s: r.data.staff, b: r.data.blocks }));
    setPositions(""); setStaff(""); setCoverage("");
    await onReload();
  });

  return (
    <div className={PANEL_CLASS_NAME}>
      <SurfaceCard label={t("quickTitle")} headingLevel={2}>
        <div className={BLOCK_CLASS_NAME}>
          <Text size="sm" tone="muted">{t("quickHint")}</Text>
          <Textarea label={t("quickPositions")} description={t("quickPositionsHint")} placeholder={"Pha chế\nPhục vụ\nThu ngân"} rows={3} value={positions} onValueChange={setPositions} />
          <Textarea label={t("quickStaff")} description={t("quickStaffHint")} placeholder={"An; pha chế, phục vụ; 30k; 44\nBình; phục vụ, thu ngân; 25k; 40"} rows={5} value={staff} onValueChange={setStaff} />
          <Textarea label={t("quickCoverage")} description={t("quickCoverageHint")} placeholder={"mọi ngày 07:00-12:00 Pha chế 1\nT7-CN 17:00-21:00 Phục vụ 1-2 cao điểm"} rows={5} value={coverage} onValueChange={setCoverage} />
          {parsed.errors.length ? <Alert tone="cautionary" title={t("quickErrors")} description={parsed.errors.join(" ")} /> : null}
          {!empty && !parsed.errors.length ? <Text size="sm" tone="muted">{t("quickPreview", { p: parsed.positions.length, s: parsed.staff.length, b: parsed.blocks.length })}</Text> : null}
          {error ? <Alert tone="negative" title={t("errTitle")} description={error} /> : null}
          {done ? <Alert tone="affirmative" title={done} /> : null}
          <div className={ROW_CLASS_NAME}><Button variant="primary" isPending={pending} isDisabled={empty || parsed.errors.length > 0} onPress={create}>{t("quickCreate")}</Button></div>
        </div>
      </SurfaceCard>
    </div>
  );
};
