"use client";

import { Button, PageContainer, SectionHeader, Stepper, SurfaceCard, Text } from "@starci/grammar/common";
import { AgentAvatar } from "@/components/avatar/PersonAvatar";
import { useLocale, useT } from "@/i18n/client";
import { modules } from "@/i18n/dict/modules";
import { moduleCopy } from "@/lib/modules";
import { NewAgentScreen } from "@/features/modules/NewAgentScreen";
import { HEADER_ROW_CLASS_NAME, PAGE_STACK_CLASS_NAME } from "@/features/modules/classNames";
import type { ModuleSpec } from "@/lib/modules";

type NewAgentViewProps = { readonly spec: ModuleSpec };

/** Client view of the purchase flow: Choose, Set up, Test. */
export const NewAgentView = ({ spec }: NewAgentViewProps) => {
  const t = useT(modules);
  const locale = useLocale();
  return (
  <PageContainer measure="product">
    <div className={PAGE_STACK_CLASS_NAME}>
      <div>
        <Button variant="ghost" size="sm" href="/modules">{t("backToModules")}</Button>
      </div>
      <div className={HEADER_ROW_CLASS_NAME}>
        <AgentAvatar module={spec.key} size="lg" label={spec.name} />
        <SectionHeader level={1} eyebrow={t("eyebrow")} title={t("buyTitle", { name: spec.name })} description={moduleCopy(spec, locale).summary} />
      </div>
      <SurfaceCard ariaLabel={t("stepsLabel")}>
        <Stepper
          label={t("stepsLabel")}
          currentStepId="setup"
          steps={[
            { id: "choose", label: t("stepChoose"), description: t("stepChooseHelp", { name: spec.name }) },
            { id: "setup", label: t("stepSetup"), description: t("stepSetupHelp") },
            { id: "test", label: t("stepTest"), description: t("stepTestHelp") },
          ]}
        />
      </SurfaceCard>
      <NewAgentScreen spec={spec} />
      <Text size="xs" tone="muted">{t("billedNote")}</Text>
    </div>
  </PageContainer>
  );
};
