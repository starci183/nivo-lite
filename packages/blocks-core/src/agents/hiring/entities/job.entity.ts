import { defineEntity, field, type EntityDefinition, type FieldDef } from "@nivo-lite/agent-sdk/entity"

import { MAX_BODY, MAX_LINE } from "../../../shared/bounds"

/** Whether a job takes candidates: open, or closed. */
export const JOB_STATUSES: readonly [string, ...Array<string>] = ["open", "closed"]

type JobFields = {
    readonly title: FieldDef<"text", false>
    readonly description: FieldDef<"text", false>
    readonly requirements: FieldDef<"text", false>
    readonly status: FieldDef<"enum", false>
}

const jobFields: JobFields = {
    title: field.text({ maxLength: MAX_LINE, searchable: true }),
    description: field.text({ maxLength: MAX_BODY, default: "empty" }),
    requirements: field.text({ maxLength: MAX_BODY, default: "empty" }),
    status: field.enum({ of: JOB_STATUSES, default: { literal: "open" } }),
}

/**
 * A job the business hires for: its title, what the work is, the written requirements a candidate is screened against (skills,
 * experience, availability; never a protected trait) and whether it still takes candidates. Graph node kind `hiring-job`.
 */
export const hiringJobEntity: EntityDefinition<JobFields> = defineEntity({
    name: "blocks-core.hiring.job",
    dataKind: "hiring-job",
    fields: jobFields,
    indexes: [
        { name: "recent", on: [{ desc: "createdAt" }, { desc: "id" }] },
        { name: "status_recent", on: ["status", { desc: "createdAt" }, { desc: "id" }] },
    ],
})
