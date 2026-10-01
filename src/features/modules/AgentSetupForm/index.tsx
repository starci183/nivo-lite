"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Alert, Button, Input, SurfaceCard, Text, Textarea } from "@starci/grammar/common";
import { AgentAvatar } from "@/components/avatar/PersonAvatar";
import { suggestAgentSetup, type AgentSetupInput } from "@/lib/actions";
import { useT } from "@/i18n/client";
import { modules } from "@/i18n/dict/modules";
import {
  BUBBLE_ROW_CLASS_NAME, BUBBLE_WIDTH_CLASS_NAME, CARD_STACK_CLASS_NAME, FORM_GRID_CLASS_NAME, MAIN_COLUMN_CLASS_NAME, RAIL_COLUMN_CLASS_NAME,
  SAVE_ROW_CLASS_NAME, TIGHT_STACK_CLASS_NAME, TWO_COLUMN_CLASS_NAME,
} from "../classNames";

/** The editable setup fields of an agent. */
export type AgentSetupValues = AgentSetupInput;

type AgentSetupFormProps = {
  values: AgentSetupValues;
  onChange: (patch: Partial<AgentSetupValues>) => void;
  onSubmit: () => void;
  submitLabel: string;
  isPending: boolean;
  error?: string;
  notice?: string;
  /** Optional block rendered right above the submit row (e.g. an order summary). */
  beforeSubmit?: ReactNode;
};

const LIMITS = { name: 40, handle: 24, role: 80, instructions: 1500, knowledge: 4000, greeting: 240, approval_rule: 300 } as const;

/** Shared setup form for installing a new agent and editing an existing one: sections on the left, live preview rail on the right. */
export const AgentSetupForm = ({ values, onChange, onSubmit, submitLabel, isPending, error, notice, beforeSubmit }: AgentSetupFormProps) => {
  const t = useT(modules);
  const counted = (helper: string, value: string, max: number): string => t("counter", { helper, used: value.length, max });
  const [description, setDescription] = useState("");
  const [suggestError, setSuggestError] = useState<string | undefined>();
  const [isSuggesting, startSuggest] = useTransition();

  const onSuggest = () => {
    setSuggestError(undefined);
    startSuggest(async () => {
      const result = await suggestAgentSetup(description);
      if (!result.ok) { setSuggestError(result.error); return; }
      onChange(result.data);
    });
  };

  const name = values.name.trim().length > 0 ? values.name.trim() : t("previewName");
  const greeting = values.greeting.trim().length > 0 ? values.greeting.trim() : t("previewGreeting", { name });

  return (
    <div className={TWO_COLUMN_CLASS_NAME}>
      <div className={MAIN_COLUMN_CLASS_NAME}>
        <SurfaceCard label={t("sectionIdentity")} headingLevel={2}>
          <div className={CARD_STACK_CLASS_NAME}>
            <div className={FORM_GRID_CLASS_NAME}>
              <Input id="agent-name" name="name" label={t("fieldName")} variant="secondary" hint={counted(t("hintName"), values.name, LIMITS.name)} value={values.name} isDisabled={isPending} onValueChange={(next) => onChange({ name: next.slice(0, LIMITS.name) })} />
              <Input id="agent-handle" name="handle" label={t("fieldHandle")} variant="secondary" hint={counted(t("hintHandle"), values.handle, LIMITS.handle)} value={values.handle} isDisabled={isPending} onValueChange={(next) => onChange({ handle: next.slice(0, LIMITS.handle) })} />
            </div>
            <Input id="agent-role" name="role" label={t("fieldRole")} variant="secondary" hint={counted(t("hintRole"), values.role, LIMITS.role)} value={values.role} isDisabled={isPending} onValueChange={(next) => onChange({ role: next.slice(0, LIMITS.role) })} />
          </div>
        </SurfaceCard>
        <SurfaceCard label={t("sectionBehaviour")} headingLevel={2}>
          <div className={CARD_STACK_CLASS_NAME}>
            <Textarea name="instructions" label={t("fieldInstructions")} description={t("descInstructions")} rows={6} maxLength={LIMITS.instructions} value={values.instructions} isDisabled={isPending} onValueChange={(instructions) => onChange({ instructions })} />
            <Textarea name="approval_rule" label={t("fieldApproval")} description={t("descApproval")} rows={3} maxLength={LIMITS.approval_rule} value={values.approval_rule} isDisabled={isPending} onValueChange={(approval_rule) => onChange({ approval_rule })} />
          </div>
        </SurfaceCard>
        <SurfaceCard label={t("sectionKnowledge")} headingLevel={2}>
          <Textarea name="knowledge" label={t("fieldKnowledge")} description={t("descKnowledge")} rows={6} maxLength={LIMITS.knowledge} placeholder={t("placeholderKnowledge")} value={values.knowledge} isDisabled={isPending} onValueChange={(knowledge) => onChange({ knowledge })} />
        </SurfaceCard>
        <SurfaceCard label={t("sectionGreeting")} headingLevel={2}>
          <Textarea name="greeting" label={t("fieldOpening")} description={t("descOpening")} rows={3} maxLength={LIMITS.greeting} placeholder={t("placeholderOpening")} value={values.greeting} isDisabled={isPending} onValueChange={(greeting) => onChange({ greeting })} />
        </SurfaceCard>
        {beforeSubmit ?? null}
        <div className={CARD_STACK_CLASS_NAME}>
          {error !== undefined ? <Alert title={t("setupNotSaved")} description={error} tone="negative" /> : null}
          <div className={SAVE_ROW_CLASS_NAME}>
            <Button variant="primary" isPending={isPending} isDisabled={values.name.trim().length === 0 || values.handle.trim().length === 0} onPress={onSubmit}>{submitLabel}</Button>
            {notice !== undefined ? <Text as="p" size="sm" tone="muted" live="polite">{notice}</Text> : null}
          </div>
        </div>
      </div>
      <div className={RAIL_COLUMN_CLASS_NAME}>
        <SurfaceCard label={t("previewTitle")} headingLevel={2}>
          <div className={CARD_STACK_CLASS_NAME}>
            <div className={BUBBLE_ROW_CLASS_NAME}>
              <AgentAvatar module={values.handle} size="md" label={name} />
              <div className={TIGHT_STACK_CLASS_NAME}>
                <Text weight="semibold">{name}</Text>
                <Text size="sm" tone="muted">{`@${values.handle.trim() || t("previewHandle")} · ${values.role.trim() || t("previewRole")}`}</Text>
              </div>
            </div>
            <div className={BUBBLE_WIDTH_CLASS_NAME}>
              <SurfaceCard ariaLabel={t("previewGreetingLabel")} depth="nested">
                <Text size="sm">{greeting}</Text>
              </SurfaceCard>
            </div>
            <Text size="xs" tone="muted">{t("previewHelp")}</Text>
          </div>
        </SurfaceCard>
        <SurfaceCard label={t("suggestTitle")} headingLevel={2}>
          <div className={CARD_STACK_CLASS_NAME}>
            <Textarea name="description" label={t("fieldDescribe")} description={t("descDescribe")} rows={3} value={description} isDisabled={isSuggesting} onValueChange={setDescription} />
            {suggestError !== undefined ? <Alert title={t("noSuggestion")} description={suggestError} tone="negative" /> : null}
            <Button variant="secondary" isPending={isSuggesting} isDisabled={description.trim().length < 3} onPress={onSuggest}>{t("suggestTitle")}</Button>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
};
