import { notFound, redirect } from "next/navigation";
import { resolveTypeRoute } from "@/lib/agent-routes";
import { agentListHref, isModuleKey } from "@/lib/modules-shared";

type SetupRedirectProps = {
  params: Promise<{ module: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** The pre-instance URL /agents/<type>/setup: to the only instance, or the instance that owns `?focus=`, else the list of instances. */
const SetupRedirect = async ({ params, searchParams }: SetupRedirectProps) => {
  const { module } = await params;
  if (!isModuleKey(module)) notFound();
  redirect((await resolveTypeRoute(module, "setup", await searchParams)) ?? agentListHref(module));
};

export default SetupRedirect;
