import { ModulesView } from "@/features/modules/ModulesView";
import { listAgentStats } from "@/features/modules/queries";

/** Modules: your installed agents and the module catalog. */
const ModulesPage = async () => {
  const stats = await listAgentStats();
  return <ModulesView stats={stats} updatedAt={new Date().toISOString()} />;
};

export default ModulesPage;
