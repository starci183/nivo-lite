import { ModuleWorkbench } from "@/features/module-workbench";
import { MODULE_KEYS } from "@/lib/modules-shared";

/** STATE-8: the workbench slot while it loads - its own card, the module's content as a skeleton (inside the module's frame). */
const WorkbenchLoading = () => <ModuleWorkbench isLoading module={MODULE_KEYS[0]} />;

export default WorkbenchLoading;
