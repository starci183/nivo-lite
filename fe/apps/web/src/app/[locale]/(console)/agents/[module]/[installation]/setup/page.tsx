import { redirect } from "next/navigation";
import { isModuleKey } from "@/lib/modules-shared";

type SetupAliasProps = { params: Promise<{ module: string; installation: string }> };

/** /agents/<type>/<id>/setup is an alias of the Setup tab, which lives at the instance's own URL. */
const SetupAlias = async ({ params }: SetupAliasProps) => {
  const { module, installation } = await params;
  redirect(isModuleKey(module) ? `/agents/${module}/${installation}` : "/agents");
};

export default SetupAlias;
