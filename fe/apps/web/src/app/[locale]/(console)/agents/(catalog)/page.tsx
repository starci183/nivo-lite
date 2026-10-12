import { ModuleCatalog } from "@/features/modules-core/ModuleCatalog";
import { isManagerRole } from "@/lib/members-shared";
import { listInstallations } from "@/lib/modules-core";
import { getSession } from "@/lib/session";

/** Module catalogue: the three modules, installed ones open, the others one click from set up. */
const ModulesCatalogPage = async () => {
  const [installations, session] = await Promise.all([listInstallations(), getSession()]);
  return <ModuleCatalog installations={installations} canInstall={isManagerRole(session.member.role)} />;
};

export default ModulesCatalogPage;
