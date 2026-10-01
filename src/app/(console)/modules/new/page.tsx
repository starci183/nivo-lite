import { NewAgentView } from "@/features/modules/NewAgentView";
import { notFound } from "next/navigation";
import { moduleSpec } from "@/lib/modules";

type NewModulePageProps = { searchParams: Promise<{ module?: string }> };

/** Install a module as a new agent. */
const NewModulePage = async ({ searchParams }: NewModulePageProps) => {
  const { module } = await searchParams;
  const spec = moduleSpec(module === "sales" || module === "accounting" ? module : "chatbot");
  if (!spec.available) notFound();
  return <NewAgentView spec={spec} />;
};

export default NewModulePage;
