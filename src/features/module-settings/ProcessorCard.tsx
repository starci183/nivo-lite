"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Badge, Button, RadioGroup, SurfaceCard, Text } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { engine as dict } from "@/i18n/dict/engine";
import type { Installation } from "@/lib/modules-shared";
import { STACK_CLASS_NAME } from "./classNames";
import { getEngineStatus, setProcessor, type EngineStatus } from "./processorActions";

type Processor = "nivo" | "openclaw";
type ProcessorCardProps = { readonly installation: Installation; readonly canEdit: boolean };

/** "Bộ xử lý": NIVO answers directly (default) or OpenClaw on the engine server, plus whether that server is alive. Owner/manager only. */
export const ProcessorCard = ({ installation, canEdit }: ProcessorCardProps) => {
  const t = useT(dict);
  const router = useRouter();
  const saved: Processor = installation.settings.processor === "openclaw" ? "openclaw" : "nivo";
  const [value, setValue] = useState<Processor>(saved);
  const [status, setStatus] = useState<EngineStatus | "unknown" | undefined>();
  const [note, setNote] = useState<{ ok: boolean; text: string } | undefined>();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!canEdit) return;
    let live = true;
    void getEngineStatus().then((r) => { if (live) setStatus(r.ok ? r.data : "unknown"); });
    return () => { live = false; };
  }, [canEdit]);

  if (!canEdit) return null;

  const ago = (iso: string): string => {
    const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
    if (s < 90) return t("ago", { n: s });
    if (s < 5400) return t("agoMin", { n: Math.round(s / 60) });
    if (s < 129_600) return t("agoHour", { n: Math.round(s / 3600) });
    return t("agoDay", { n: Math.round(s / 86_400) });
  };
  const known = status !== undefined && status !== "unknown" ? status : null;
  const statusLine = status === undefined ? "" : known === null ? t("unknown") : known.lastHeartbeat === null ? t("never") : t(known.online ? "online" : "stale", { ago: ago(known.lastHeartbeat) });

  const save = () => {
    setNote(undefined);
    startTransition(async () => {
      const r = await setProcessor(installation.id, value);
      setNote(r.ok ? { ok: true, text: t("saved") } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });
  };

  return (
    <SurfaceCard label={t("title")} headingLevel={2}>
      <div className={STACK_CLASS_NAME}>
        <Text size="sm" tone="muted">{t("hint")}</Text>
        <RadioGroup
          label={t("title")}
          isLabelHidden
          options={[
            { value: "nivo", label: t("nivo"), description: t("nivoHelp") },
            { value: "openclaw", label: t("openclaw"), description: t("openclawHelp") },
          ]}
          value={value}
          isDisabled={pending}
          onValueChange={(v) => setValue(v === "openclaw" ? "openclaw" : "nivo")}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Badge isDot tone={known?.online ? "success" : "neutral"}>{t("status")}</Badge>
          <Text size="sm" tone="muted">{statusLine}</Text>
        </div>
        <div>
          <Button variant="secondary" isPending={pending} isDisabled={value === saved} onPress={save}>{t("save")}</Button>
        </div>
        {note !== undefined ? <Alert title={note.ok ? t("saved") : t("notSaved")} description={note.ok ? undefined : note.text} tone={note.ok ? "affirmative" : "negative"} /> : null}
      </div>
    </SurfaceCard>
  );
};
