"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { installAgent } from "@/lib/actions";
import { moduleCopy, type ModuleSpec } from "@/lib/modules";
import { useLocale, useT } from "@/i18n/client";
import { modules } from "@/i18n/dict/modules";
import { CheckoutSummary } from "@/features/promo-ads/CheckoutSummary";
import { AgentSetupForm, type AgentSetupValues } from "../AgentSetupForm";

type NewAgentScreenProps = { spec: ModuleSpec };

/** Purchase intake: review the setup (or let AI suggest it), then add the agent to the workspace. */
export const NewAgentScreen = ({ spec }: NewAgentScreenProps) => {
  const router = useRouter();
  const t = useT(modules);
  const copy = moduleCopy(spec, useLocale());
  const [values, setValues] = useState<AgentSetupValues>({
    name: `${spec.name} Agent`, handle: spec.key, role: copy.defaultRole, instructions: copy.defaultInstructions,
    knowledge: "", greeting: "", approval_rule: t("defaultApprovalRule"),
  });
  const [installError, setInstallError] = useState<string | undefined>();
  const [isInstalling, startInstall] = useTransition();

  const onInstall = () => {
    setInstallError(undefined);
    startInstall(async () => {
      const result = await installAgent(spec.key, values);
      if (!result.ok) { setInstallError(result.error); return; }
      router.push(`/modules/${result.data.id}/chat?welcome=1`);
    });
  };

  return (
    <AgentSetupForm
      values={values}
      onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
      onSubmit={onInstall}
      submitLabel={t("addToWorkspace")}
      isPending={isInstalling}
      error={installError}
      beforeSubmit={<CheckoutSummary moduleName={spec.name} />}
    />
  );
};
