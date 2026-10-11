"use client";

import { useParams } from "next/navigation";
import { SettingsScreen } from "@/features/module-settings/SettingsScreen";
import { isModuleKey, MODULE_KEYS } from "@/lib/modules-shared";

/** STATE-8: the Settings tab itself, with no data yet - the same cards, names and values as skeletons (inside the module's frame). */
const SettingsLoading = () => {
  const { module } = useParams<{ module?: string }>();
  return <SettingsScreen isLoading installation={null} moduleKey={isModuleKey(module) ? module : MODULE_KEYS[0]} canEdit={false} connectionOptions={[]} selectedConnections={[]} />;
};

export default SettingsLoading;
