import { notFound, redirect } from "next/navigation";
import { resolveTypeRoute } from "@/lib/agent-routes";
import { agentListHref, isModuleKey } from "@/lib/modules-shared";

type SettingsRedirectProps = {
  params: Promise<{ module: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** The pre-instance URL /agents/<type>/settings: to the only instance, or the instance that owns `?focus=`, else the list of instances. */
const SettingsRedirect = async ({ params, searchParams }: SettingsRedirectProps) => {
  const { module } = await params;
  if (!isModuleKey(module)) notFound();
  redirect((await resolveTypeRoute(module, "settings", await searchParams)) ?? agentListHref(module));
};

export default SettingsRedirect;
