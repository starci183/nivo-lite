"use client";

import { Heading, PageContainer, SurfaceCard, Text } from "@starci/grammar/common";
import { PAGE_STACK_CLASS_NAME } from "@/features/modules/classNames";
import { useT } from "@/i18n/client";
import { modules } from "@/i18n/dict/modules";

/** Loading skeleton for the agent setup page. */
const AgentSetupLoading = () => {
  const t = useT(modules);
  return (
    <PageContainer measure="product">
      <div className={PAGE_STACK_CLASS_NAME}>
        <Heading level={1} isSkeleton>{t("loadingTitle")}</Heading>
        <SurfaceCard>
          <Text as="p" isSkeleton>{t("loadingText")}</Text>
        </SurfaceCard>
      </div>
    </PageContainer>
  );
};

export default AgentSetupLoading;
