import { z } from "zod"
import {
    ENTERPRISE_SEED_SCHEMA,
    ENTERPRISE_SEED_TARGETS,
    type EnterpriseSeedDocument,
} from "./enterprise-seed.contracts"

/**
 * One enterprise seed document, the same shape `enterprise-seed.schema.json` gives the stack seed step: names of 1 to 120 characters,
 * an identifier of short lowercase ASCII words joined by hyphens (`nivo-web`), at most 63 characters.
 */
export const enterpriseSeedDocument: z.ZodType<EnterpriseSeedDocument> = z.strictObject({
    schema: z.literal(ENTERPRISE_SEED_SCHEMA),
    identifier: z
        .string()
        .max(63)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
    target: z.enum(ENTERPRISE_SEED_TARGETS),
    workspaceName: z.string().trim().min(1).max(120),
    ownerWorkspace: z.string().trim().min(1).max(120),
})
