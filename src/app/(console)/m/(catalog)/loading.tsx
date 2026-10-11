import { ModuleCatalog } from "@/features/modules-core/ModuleCatalog";

/** STATE-8: the module catalogue itself, with no installations yet - the registry's cards real, each status and action a skeleton. */
const ModulesCatalogLoading = () => <ModuleCatalog isLoading installations={[]} canInstall={false} />;

export default ModulesCatalogLoading;
