"use client";

import { useParams } from "next/navigation";
import { InstanceList } from "@/features/agent-instances/InstanceList";
import { isModuleKey, MODULE_KEYS } from "@/lib/modules-shared";

/** STATE-8: the list of a type's instances while it loads - real trail, heading and command, three skeleton rows. */
const InstanceListLoading = () => {
  const { module } = useParams<{ module?: string }>();
  return <InstanceList isLoading moduleKey={isModuleKey(module) ? module : MODULE_KEYS[0]} rows={[]} canInstall={false} />;
};

export default InstanceListLoading;
