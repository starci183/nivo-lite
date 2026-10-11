"use client";

import { useParams } from "next/navigation";
import { SetupScreen } from "@/features/module-setup/SetupScreen";
import { isModuleKey, MODULE_KEYS } from "@/lib/modules-shared";

/** STATE-8: the Setup tab itself, with no data yet - the same cards, its chat, draft, gate states and versions as skeletons (inside the module's frame). */
const SetupLoading = () => {
  const { module } = useParams<{ module?: string }>();
  return <SetupScreen isLoading installation={null} moduleKey={isModuleKey(module) ? module : MODULE_KEYS[0]} initialSession={null} initialRevisions={[]} initialMessages={[]} initialVersions={[]} />;
};

export default SetupLoading;
