"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Avatar, Badge, Button, Input, SegmentedControl, Switch, SurfaceCard, Text } from "@starci/grammar/common";
import { AgentAvatar } from "@/components/avatar/PersonAvatar";
import { useLocale, useT } from "@/i18n/client";
import { modulesCore } from "@/i18n/dict/modulesCore";
import { renameInstance, renameModule, setModuleLive, setOperatingMode } from "@/lib/module-actions";
import { moduleDef, pick } from "@/lib/module-registry";
import type { Installation, ModuleKey, OperatingMode } from "@/lib/modules-shared";
import { AgentConnectionsCard, type ConnectionOption } from "./AgentConnectionsCard";
import { ACTIONS_CLASS_NAME, GRID_CLASS_NAME, GROW_CLASS_NAME, ROW_CLASS_NAME, STACK_CLASS_NAME } from "./classNames";
import { ModuleAutomations } from "./ModuleAutomations";
import { ProcessorCard } from "./ProcessorCard";
import { SETTINGS_EXTRAS } from "./registry";

type SettingsScreenProps = {
  /** Null while the settings load (isLoading). */
  readonly installation: Installation | null;
  /** The module whose settings these are: known from the route before the installation resolves. */
  readonly moduleKey: ModuleKey;
  /** STATE-8: the same tab while its data loads - card labels and control labels stay; names, values and the data-owned cards are skeletons. */
  readonly isLoading?: boolean;
  readonly canEdit: boolean;
  /** The workspace owner: may change which connections this agent uses and how far. */
  readonly canGrant?: boolean;
  /** The workspace connections this module can use, and the ones its agent has ticked. */
  readonly connectionOptions: ReadonlyArray<ConnectionOption>;
  readonly selectedConnections: ReadonlyArray<string>;
};

/** Settings tab of a module. Every control saves on its own and reports its own result. */
export const SettingsScreen = ({ installation, moduleKey, isLoading = false, canEdit, canGrant = false, connectionOptions, selectedConnections }: SettingsScreenProps) => {
  const t = useT(modulesCore);
  const router = useRouter();
  // One name field: for a multi-instance type the instance label and its agent share the name (the agent keeps the first 40 characters).
  const isInstance = installation?.isMulti === true;
  const savedName = isInstance ? (installation?.name ?? "") : (installation?.agentName ?? "");
  const [name, setName] = useState(savedName);
  const [mode, setMode] = useState<OperatingMode>(installation?.operatingMode ?? "assist");
  const [live, setLive] = useState(installation?.liveEnabled ?? false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | undefined>();
  const [pending, startTransition] = useTransition();
  const [which, setWhich] = useState<"name" | "mode" | "live" | null>(null);
  const locale = useLocale();
  const typeShort = pick(moduleDef(moduleKey).shortName, locale);
  const canLive = installation?.activeContextVersionId != null;
  const extrasKey = moduleDef(moduleKey).settingsExtras;
  const Extras = extrasKey === null ? undefined : SETTINGS_EXTRAS[extrasKey];

  // The instance label first (it can be refused as a duplicate), then the agent that shares it.
  const saveName = async (target: Installation, value: string) => {
    if (!isInstance) return renameModule(target.id, value);
    const renamed = await renameInstance(target.id, value);
    return renamed.ok ? renameModule(target.id, value.trim().slice(0, 40)) : renamed;
  };

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
              {installation === null ? <Avatar name="" size="lg" isSkeleton /> : <AgentAvatar module={installation.moduleKey} size="lg" label={installation.agentName} online={live} />}
              <div className={GROW_CLASS_NAME}>
                <Input id="module-name" name="name" label={t(isInstance ? "instanceNameTitle" : "displayName")} variant="secondary" hint={t(isInstance ? "instanceNameSettingsHint" : "displayNameHint")} value={name} isSkeleton={isLoading} isDisabled={!canEdit || pending} onValueChange={(v) => setName(v.slice(0, isInstance ? 80 : 40))} />
              </div>
            </div>
            <Text size="sm" tone="muted" isSkeleton={isLoading}>{t("agentLine", { handle: installation?.agentHandle ?? "" })}</Text>
            <div className={ACTIONS_CLASS_NAME}>
              <Button variant="secondary" isSkeleton={isLoading} isPending={pending && which === "name"} isDisabled={installation === null || !canEdit || name.trim().length < (isInstance ? 1 : 2) || name.trim() === savedName} onPress={() => installation !== null && act("name", () => saveName(installation, name))}>{t(isInstance ? "saveInstanceName" : "saveName")}</Button>
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
              isSkeleton={isLoading}
              isDisabled={!canEdit || pending}
              onValueChange={(v) => {
                if (installation === null) return;
                const next: OperatingMode = v === "autopilot" ? "autopilot" : "assist";
                const prev = mode;
                setMode(next);
                act("mode", () => setOperatingMode(installation.id, next), () => setMode(prev));
              }}
            />
            <Text size="sm" isSkeleton={isLoading}>{mode === "autopilot" ? t("modeAutopilotHelp") : t("modeAssistHelp")}</Text>
            <Text size="xs" tone="muted">{t("modeNote")}</Text>
            {isInstance ? <Text size="xs" tone="muted">{t("authorityShared", { type: typeShort })}</Text> : null}
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
              isSkeleton={isLoading}
              isDisabled={!canEdit || pending || (!canLive && !live)}
              onSelectedChange={(next) => {
                if (installation === null) return;
                setLive(next);
                act("live", () => setModuleLive(installation.id, next), () => setLive(!next));
              }}
            />
            <Badge isDot isSkeleton={isLoading} tone={live ? "success" : "neutral"}>{live ? t("status_live") : t("status_paused")}</Badge>
            <Text size="sm" tone="muted">{t("liveHelp")}</Text>
            {!canLive && !isLoading ? <Text size="sm">{t("liveNeedsVersion")}</Text> : null}
          </div>
        </SurfaceCard>

        {installation?.agentId ? (
          <AgentConnectionsCard agentId={installation.agentId} options={connectionOptions} selected={selectedConnections} canEdit={canGrant} />
        ) : null}

        {/* Shifts speaks to staff only through the Telegram/Zalo connections bound to its agent; with none, shift notices stay in Office. */}
        {moduleKey === "shifts" && !isLoading && installation !== null && !connectionOptions.some((o) => o.status !== "disconnected" && (o.access ?? null) !== null)
          ? <Alert tone="informative" title={t("shiftsBindChannel")} />
          : null}

        {installation !== null ? <ModuleAutomations moduleKey={installation.moduleKey} canEdit={canEdit} /> : null}

        {installation !== null ? <ProcessorCard installation={installation} canEdit={canEdit} /> : null}

        {installation !== null && Extras !== undefined ? <Extras installation={installation} canEdit={canEdit} /> : null}

        {note !== undefined ? <Alert title={note.ok ? t("saved") : t("notSaved")} description={note.ok ? undefined : note.text} tone={note.ok ? "affirmative" : "negative"} /> : null}
      </div>
    </div>
  );
};
