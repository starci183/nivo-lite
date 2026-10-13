import { redirect } from "next/navigation"
import { isModuleKey } from "@/lib/module-registry"

type NewModulePageProps = { searchParams: Promise<{ module?: string }> }

/** Moved: installing a module is the Install button of /agents. */
const NewModulePage = async ({ searchParams }: NewModulePageProps) => {
    const { module } = await searchParams
    redirect(isModuleKey(module) ? `/agents/${module}` : "/agents")
}

export default NewModulePage
