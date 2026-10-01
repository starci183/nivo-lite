"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Badge, Button, Input, SegmentedControl, Switch, SurfaceCard, Text } from "@starci/grammar/common";
import { AgentAvatar } from "@/components/avatar/PersonAvatar";
import { useT } from "@/i18n/client";
import { modulesCore } from "@/i18n/dict/modulesCore";
import { renameModule, setModuleLive, setOperatingMode } from "@/lib/module-actions";
import type { Installation, OperatingMode } from "@/lib/modules-shared";
import { AgentConnectionsCard, type ConnectionOption } from "./AgentConnectionsCard";
import { GRID_CLASS_NAME, ROW_CLASS_NAME, STACK_CLASS_NAME } from "./classNames";
import { ProcessorCard } from "./ProcessorCard";

type SettingsScreenProps = {
  readonly installation: Installation;
  readonly canEdit: boolean;
  /** The workspace connections this module can use, and the ones its agent has ticked. */
  readonly connectionOptions: ReadonlyArray<ConnectionOption>;
  readonly selectedConnections: ReadonlyArray<string>;
};

/** Settings tab of a module. Every control saves on its own and reports its own result. */
export const SettingsScreen = ({ installation, canEdit, connectionOptions, selectedConnections }: SettingsScreenProps) => {
  const t = useT(modulesCore);
  const router = useRouter();
  const [name, setName] = useState(installation.agentName);
  const [mode, setMode] = useState<OperatingMode>(installation.operatingMode);
  const [live, setLive] = useState(installation.liveEnabled);
  const [note, setNote] = useState<{ ok: boolean; text: string } | undefined>();
  const [pending, startTransition] = useTransition();
  const [which, setWhich] = useState<"name" | "mode" | "live" | null>(null);
  const canLive = installation.activeContextVersionId !== null;

  const act = (kind: "name" | "mode" | "live", fn: () => Promise<{ ok: true } | { ok: false; error: string }>, onFail?: () => void) => {
    setNote(undefined);
    setWhich(kind);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) { setNote({ ok: false, text: result.error }); onFail?.(); return; }
      setNote({ ok: true, text: t("saved") });
      router.refresh();
    });
  };

  return (
    <div className={GRID_CLASS_NAME}>
      <div className={STACK_CLASS_NAME}>
        <SurfaceCard label={t("agentTitle")} headingLevel={2}>
          <div className={STACK_CLASS_NAME}>
            <div className={ROW_CLASS_NAME}>
              <AgentAvatar module={installation.moduleKey} size="lg" label={installation.agentName} online={live} />
              <div className="min-w-0 flex-1">
                <Input id="module-name" name="name" label={t("displayName")} variant="secondary" hint={t("displayNameHint")} value={name} isDisabled={!canEdit || pending} onValueChange={(v) => setName(v.slice(0, 40))} />
              </div>
            </div>
            <Text size="sm" tone="muted">{t("agentLine", { handle: installation.agentHandle })}</Text>
            <div>
              <Button variant="secondary" isPending={pending && which === "name"} isDisabled={!canEdit || name.trim().length < 2 || name.trim() === installation.agentName} onPress={() => act("name", () => renameModule(installation.id, name))}>{t("saveName")}</Button>
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard label={t("modeTitle")} headingLevel={2}>
          <div className={STACK_CLASS_NAME}>
            <SegmentedControl
              label={t("modeTitle")}
              isLabelHidden
              options={[{ value: "assist", label: t("modeAssist") }, { value: "autopilot", label: t("modeAutopilot") }]}
              value={mode}
              isDisabled={!canEdit || pending}
              onValueChange={(v) => {
                const next: OperatingMode = v === "autopilot" ? "autopilot" : "assist";
                const prev = mode;
                setMode(next);
                act("mode", () => setOperatingMode(installation.id, next), () => setMode(prev));
              }}
            />
            <Text size="sm">{mode === "autopilot" ? t("modeAutopilotHelp") : t("modeAssistHelp")}</Text>
            <Text size="xs" tone="muted">{t("modeNote")}</Text>
          </div>
        </SurfaceCard>
      </div>

      <div className={STACK_CLASS_NAME}>
        <SurfaceCard label={t("liveTitle")} headingLevel={2}>
          <div className={STACK_CLASS_NAME}>
            <Switch
              name="live"
              label={t("liveSwitch")}
              isSelected={live}
              isDisabled={!canEdit || pending || (!canLive && !live)}
              onSelectedChange={(next) => {
                setLive(next);
                act("live", () => setModuleLive(installation.id, next), () => setLive(!next));
              }}
            />
            <Badge isDot tone={live ? "success" : "neutral"}>{live ? t("status_live") : t("status_paused")}</Badge>
            <Text size="sm" tone="muted">{t("liveHelp")}</Text>
            {!canLive ? <Text size="sm">{t("liveNeedsVersion")}</Text> : null}
          </div>
        </SurfaceCard>

        {installation.agentId ? (
          <AgentConnectionsCard agentId={installation.agentId} options={connectionOptions} selected={selectedConnections} canEdit={canEdit} />
        ) : null}

        <ProcessorCard installation={installation} canEdit={canEdit} />

        {note !== undefined ? <Alert title={note.ok ? t("saved") : t("notSaved")} description={note.ok ? undefined : note.text} tone={note.ok ? "affirmative" : "negative"} /> : null}
      </div>
    </div>
  );
};
