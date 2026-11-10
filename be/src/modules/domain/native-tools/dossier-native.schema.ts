import { z } from "zod"
import { FINDING_SEVERITIES, FINDING_STATUSES } from "@modules/domain/dossier-review"

/** `nivo.dossier.status.get`: takes no argument. */
export const DOSSIER_STATUS_SCHEMA: z.ZodObject<{}, z.core.$strict> = z.object({}).strict()

/** `nivo.dossier.finding.list`: a page of the findings of the dossier review, the most severe first. */
export const DOSSIER_FINDINGS_LIST_SCHEMA: z.ZodObject<
    {
        dossierId: z.ZodOptional<z.ZodUUID>
        statuses: z.ZodOptional<
            z.ZodArray<
                z.ZodEnum<{
                    open: "open"
                    confirmed: "confirmed"
                    dismissed: "dismissed"
                    resolved: "resolved"
                }>
            >
        >
        severities: z.ZodOptional<
            z.ZodArray<
                z.ZodEnum<{
                    critical: "critical"
                    high: "high"
                    medium: "medium"
                    low: "low"
                }>
            >
        >
        first: z.ZodDefault<z.ZodNumber>
        after: z.ZodOptional<z.ZodString>
    },
    z.core.$strict
> = z
    .object({
        dossierId: z.uuid().optional(),
        statuses: z.array(z.enum(FINDING_STATUSES)).min(1).max(FINDING_STATUSES.length).optional(),
        severities: z.array(z.enum(FINDING_SEVERITIES)).min(1).max(FINDING_SEVERITIES.length).optional(),
        first: z.number().int().min(1).max(20).default(10),
        after: z.string().min(1).max(500).optional(),
    })
    .strict()

/** The arguments of `nivo.dossier.finding.list` as its validator reads them. */
export type DossierFindingsListInput = z.output<typeof DOSSIER_FINDINGS_LIST_SCHEMA>

/** The schemas the manifest advertises, generated from the validators. */
export const DOSSIER_STATUS_INPUT_SCHEMA: z.core.ZodStandardJSONSchemaPayload<z.ZodObject<{}, z.core.$strict>> =
    z.toJSONSchema(DOSSIER_STATUS_SCHEMA, { io: "input" })
export const DOSSIER_FINDINGS_LIST_INPUT_SCHEMA: z.core.ZodStandardJSONSchemaPayload<
    z.ZodObject<
        {
            dossierId: z.ZodOptional<z.ZodUUID>
            statuses: z.ZodOptional<
                z.ZodArray<
                    z.ZodEnum<{
                        open: "open"
                        confirmed: "confirmed"
                        dismissed: "dismissed"
                        resolved: "resolved"
                    }>
                >
            >
            severities: z.ZodOptional<
                z.ZodArray<
                    z.ZodEnum<{
                        critical: "critical"
                        high: "high"
                        medium: "medium"
                        low: "low"
                    }>
                >
            >
            first: z.ZodDefault<z.ZodNumber>
            after: z.ZodOptional<z.ZodString>
        },
        z.core.$strict
    >
> = z.toJSONSchema(DOSSIER_FINDINGS_LIST_SCHEMA, { io: "input" })
