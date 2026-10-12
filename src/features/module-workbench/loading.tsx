"use client";

import type { ComponentType } from "react";
import { useParams } from "next/navigation";
import { Skeleton, SurfaceCard } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { modulesCore } from "@/i18n/dict/modulesCore";
import { moduleDef } from "@/lib/module-registry";
import { isModuleKey } from "@/lib/modules-shared";
import { AccountingWorkbenchLoading } from "@/features/workbench-accounting/loading";
import { ContentWorkbenchLoading } from "@/features/module-content/loading";
import { HiringWorkbenchLoading } from "@/features/module-hiring/loading";
import { ShiftsWorkbenchLoading } from "@/features/module-shifts/loading";
import { VideoWorkbenchLoading } from "@/features/module-video/loading";
import { ChatbotWorkbenchLoading } from "@/features/workbench-chatbot/loading";
import { SalesWorkbenchLoading } from "@/features/workbench-sales/loading";

/**
 * Loading views of the workbenches built on the agent dashboard frame, by the same key as WORKBENCHES in ./registry.
 * A module adopting the frame adds ONE line here (its `...WorkbenchLoading`: the frame with `isLoading`, real figure terms and tab labels).
 */
const LOADINGS: Readonly<Record<string, ComponentType>> = {
  chatbot: ChatbotWorkbenchLoading,
  sales: SalesWorkbenchLoading,
  accounting: AccountingWorkbenchLoading,
  content: ContentWorkbenchLoading,
  hiring: HiringWorkbenchLoading,
  shifts: ShiftsWorkbenchLoading,
  video: VideoWorkbenchLoading,
};

/** STATE-8: the workbench slot while it loads - the module's own frame, or (a module not on the frame yet) its card with the content as a skeleton. */
export const WorkbenchLoading = () => {
  const t = useT(modulesCore);
  const { module } = useParams<{ module?: string }>();
  const key = isModuleKey(module) ? moduleDef(module).workbench : null;
  const Loading = key === null ? undefined : LOADINGS[key];
  return Loading ? <Loading /> : <SurfaceCard ariaLabel={t("workbenchTitle")}><Skeleton shape="text" lines={4} /></SurfaceCard>;
};
