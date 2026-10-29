import { N8nPlatformConfigEntity } from "./n8n-platform-config.entity"
import { N8nRunEntity } from "./n8n-run.entity"

export { N8nPlatformConfigEntity, N8nRunEntity }

/** The entities of the n8n-runs capability, registered on the primary connection. */
export const n8nRunsEntities = [N8nRunEntity, N8nPlatformConfigEntity] as const
