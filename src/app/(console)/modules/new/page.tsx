import { redirect } from "next/navigation";

type NewModulePageProps = { searchParams: Promise<{ module?: string }> };

/** Moved: installing a module is the Install button of /m. */
const NewModulePage = async ({ searchParams }: NewModulePageProps) => {
  const { module } = await searchParams;
  redirect(module === "sales" || module === "accounting" || module === "chatbot" ? `/m/${module}` : "/m");
};

export default NewModulePage;
