import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { ModuleChrome } from "@/features/modules-core/ModuleChrome";
import { isManagerRole } from "@/lib/members-shared";
import { getInstallation, listInstallations } from "@/lib/modules-core";
import { isModuleKey } from "@/lib/modules-shared";
import { getSession } from "@/lib/session";

type ModuleLayoutProps = { readonly children: ReactNode; readonly params: Promise<{ module: string }> };

/** Frame of one module: its siblings, header with status and version, and the Setup | Workbench | Settings tabs. */
const ModuleLayout = async ({ children, params }: ModuleLayoutProps) => {
  const { module } = await params;
  if (!isModuleKey(module)) notFound();
  const [session, installation, installations] = await Promise.all([getSession(), getInstallation(module), listInstallations()]);
  if (!installation) redirect("/m");
  return (
    <ModuleChrome current={installation} installations={installations} canSetup={isManagerRole(session.member.role)}>
      {children}
    </ModuleChrome>
  );
};

export default ModuleLayout;
