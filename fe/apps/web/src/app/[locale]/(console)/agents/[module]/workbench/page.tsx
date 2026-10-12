import { notFound, redirect } from "next/navigation";
import { resolveTypeRoute } from "@/lib/agent-routes";
import { agentListHref, isModuleKey } from "@/lib/modules-shared";

type WorkbenchRedirectProps = {
  params: Promise<{ module: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** The pre-instance URL /agents/<type>/workbench: to the only instance, or the instance that owns `?focus=`, else the list of instances. */
const WorkbenchRedirect = async ({ params, searchParams }: WorkbenchRedirectProps) => {
  const { module } = await params;
  if (!isModuleKey(module)) notFound();
  redirect((await resolveTypeRoute(module, "workbench", await searchParams)) ?? agentListHref(module));
};

export default WorkbenchRedirect;
