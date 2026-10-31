import { z } from "zod"
import { FINDING_SEVERITIES, FINDING_STATUSES } from "@modules/domain/dossier-review"

/** `dossier.status`: takes no argument. */
export const DOSSIER_STATUS_SCHEMA = z.object({}).strict()

/** `dossier.findings.list`: a page of the findings of the dossier review, the most severe first. */
export const DOSSIER_FINDINGS_LIST_SCHEMA = z
    .object({
        dossierId: z.uuid().optional(),
        statuses: z.array(z.enum(FINDING_STATUSES)).min(1).max(FINDING_STATUSES.length).optional(),
        severities: z.array(z.enum(FINDING_SEVERITIES)).min(1).max(FINDING_SEVERITIES.length).optional(),
        first: z.number().int().min(1).max(20).default(10),
        after: z.string().min(1).max(500).optional(),
    })
    .strict()

/** The schemas the manifest advertises, generated from the validators. */
export const DOSSIER_STATUS_INPUT_SCHEMA = z.toJSONSchema(DOSSIER_STATUS_SCHEMA, { io: "input" })
export const DOSSIER_FINDINGS_LIST_INPUT_SCHEMA = z.toJSONSchema(DOSSIER_FINDINGS_LIST_SCHEMA, { io: "input" })
