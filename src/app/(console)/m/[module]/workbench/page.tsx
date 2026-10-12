import { notFound } from "next/navigation";
import { ModuleWorkbench } from "@/features/module-workbench";
import { isModuleKey } from "@/lib/modules-shared";

type WorkbenchPageProps = {
  params: Promise<{ module: string }>;
  searchParams: Promise<{ tab?: string | string[]; focus?: string | string[] }>;
};

const first = (v: string | string[] | undefined): string | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null)) || null;

/** Workbench slot: the module's own working surface (built per module). `?tab=` and `?focus=` are the shared deep-link contract of the agent dashboard frame. */
const WorkbenchPage = async ({ params, searchParams }: WorkbenchPageProps) => {
  const { module } = await params;
  if (!isModuleKey(module)) notFound();
  const query = await searchParams;
  return <ModuleWorkbench module={module} tab={first(query.tab)} focus={first(query.focus)} />;
};

export default WorkbenchPage;
