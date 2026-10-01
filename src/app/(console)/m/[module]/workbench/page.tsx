import { notFound } from "next/navigation";
import { ModuleWorkbench } from "@/features/module-workbench";
import { isModuleKey } from "@/lib/modules-shared";

type WorkbenchPageProps = { params: Promise<{ module: string }> };

/** Workbench slot: the module's own working surface (built per module). */
const WorkbenchPage = async ({ params }: WorkbenchPageProps) => {
  const { module } = await params;
  if (!isModuleKey(module)) notFound();
  return <ModuleWorkbench module={module} />;
};

export default WorkbenchPage;
