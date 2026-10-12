import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { ModuleChrome } from "@/features/modules-core/ModuleChrome";
import { isManagerRole } from "@/lib/members-shared";
import { getInstallationById, listInstallations } from "@/lib/modules-core";
import { agentHref, isModuleKey } from "@/lib/modules-shared";
import { getSession } from "@/lib/session";

type InstanceLayoutProps = { readonly children: ReactNode; readonly params: Promise<{ module: string; installation: string }> };

/** Frame of one agent instance: the installed agents, its header (instance name, status, version) and the Setup | Workbench | Settings tabs. */
const InstanceLayout = async ({ children, params }: InstanceLayoutProps) => {
  const { module, installation: installationId } = await params;
  if (!isModuleKey(module)) notFound();
  const [session, installation, installations] = await Promise.all([getSession(), getInstallationById(installationId), listInstallations()]);
  if (!installation) redirect(agentHref(module, null));
  if (installation.moduleKey !== module) redirect(agentHref(installation.moduleKey, installation.id));
  return (
    <ModuleChrome current={installation} moduleKey={module} installations={installations} canSetup={isManagerRole(session.member.role)}>
      {children}
    </ModuleChrome>
  );
};

export default InstanceLayout;
