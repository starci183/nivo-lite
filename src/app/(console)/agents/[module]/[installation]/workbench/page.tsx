import { notFound } from "next/navigation";
import { ModuleWorkbench } from "@/features/module-workbench";
import { getInstallationById } from "@/lib/modules-core";
import { isModuleKey } from "@/lib/modules-shared";

type WorkbenchPageProps = {
  params: Promise<{ module: string; installation: string }>;
  searchParams: Promise<{ tab?: string | string[]; focus?: string | string[] }>;
};

const first = (v: string | string[] | undefined): string | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null)) || null;

/** Workbench slot of one instance: the module's own working surface, scoped to this instance (its conversations, bookings, prospects and decisions). `?tab=` and `?focus=` are the shared deep-link contract of the agent dashboard frame. */
const WorkbenchPage = async ({ params, searchParams }: WorkbenchPageProps) => {
  const { module, installation: installationId } = await params;
  if (!isModuleKey(module)) notFound();
  const [query, installation] = await Promise.all([searchParams, getInstallationById(installationId)]);
  if (!installation || installation.moduleKey !== module) notFound();
  return <ModuleWorkbench module={module} installation={installation} tab={first(query.tab)} focus={first(query.focus)} />;
};

export default WorkbenchPage;
