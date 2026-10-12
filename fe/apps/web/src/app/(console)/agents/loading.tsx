"use client";

import { useParams } from "next/navigation";
import { ModuleChrome } from "@/features/modules-core/ModuleChrome";
import { isModuleKey, MODULE_KEYS } from "@/lib/modules-shared";

/** STATE-8: the frame of a module while it loads (its siblings, header and tab labels), without the tab body. */
const ModuleFrameLoading = () => {
  const { module } = useParams<{ module?: string }>();
  return <ModuleChrome isLoading current={null} moduleKey={isModuleKey(module) ? module : MODULE_KEYS[0]} installations={[]} canSetup />;
};

export default ModuleFrameLoading;
