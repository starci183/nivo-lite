import { In, Not } from "typeorm"
import type { ContentPillarDraft, contentPillarsEntities } from "@modules/domain/content-pillars"
import { entityRowBuilder } from "./entity-row.builder"

type ContentPillarEntity = InstanceType<(typeof contentPillarsEntities)[0]>

/** A saved theme of workspace `ws-1`, with the fields a spec rarely changes filled. */
export const pillarRow = entityRowBuilder<ContentPillarEntity>({
    id: "pillar-1",
    workspaceId: "ws-1",
    name: "Menu",
    description: "Daily menu",
    weight: 2,
    sort: 0,
    active: true,
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
})

/** The theme row an insert carries (no creation or update stamp: the database sets them), with some fields changed and some left out. */
const insertedOf = (changes: Partial<ContentPillarEntity>, omitted: ReadonlyArray<string> = []) =>
    Object.fromEntries(
        Object.entries(pillarRow(changes)).filter(
            ([key]) => key !== "createdAt" && key !== "updatedAt" && !omitted.includes(key),
        ),
    )

/** The drafts a manager sends: the kept theme, then a new one, both with padded text. */
export const paddedDrafts: ReadonlyArray<ContentPillarDraft> = [
    { id: "pillar-1", name: " Menu ", description: " Daily ", weight: 2, active: true },
    { name: " New ", description: " Fresh ", weight: 1, active: false },
]

/** The rows the replace expects the insert to carry for {@link paddedDrafts}: trimmed, kept id first. */
export const paddedInserted = [
    insertedOf({ description: "Daily" }),
    insertedOf({ name: "New", description: "Fresh", weight: 1, sort: 1, active: false }, ["id"]),
]

/** What the replace deletes when only `pillar-1` is kept. */
export const deleteExceptPillar1 = { workspaceId: "ws-1", id: Not(In(["pillar-1"])) }

/** What the replace deletes when nothing is kept. */
export const deleteAllOfWs1 = { workspaceId: "ws-1" }
