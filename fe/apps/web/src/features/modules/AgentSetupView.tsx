"use client";

import { Button, PageContainer } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { modules } from "@/i18n/dict/modules";
import { AgentSettingsScreen } from "@/features/modules/AgentSettingsScreen";
import { PAGE_STACK_CLASS_NAME } from "@/features/modules/classNames";
import type { AgentConversationRow } from "@/features/modules/queries";
import type { Agent } from "@/lib/types";

type AgentSetupViewProps = { readonly agent: Agent; readonly conversations: ReadonlyArray<AgentConversationRow> };

/** Client view of the page (grammar surfaces render on the client). */
export const AgentSetupView = ({ agent, conversations }: AgentSetupViewProps) => {
  const t = useT(modules);
  return (
  <PageContainer measure="product">
    <div className={PAGE_STACK_CLASS_NAME}>
      <div>
        <Button variant="ghost" size="sm" href="/modules">{t("backToModules")}</Button>
      </div>
      <AgentSettingsScreen key={agent.id} agent={agent} conversations={conversations} />
    </div>
  </PageContainer>
  );
};
