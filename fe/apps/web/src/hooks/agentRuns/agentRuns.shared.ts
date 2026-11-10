import { AGENTS_ROUTE } from "@/modules/routes"

/** The route of one run of an agent instance, below the workspace. */
export const runPathOf = (module: string, installationId: string, runId: string): string =>
    `${AGENTS_ROUTE}/${module}/${installationId}/work/runs/${runId}`
