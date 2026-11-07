import type { EntityDefinition } from "./entity.types"
import { manifestOf } from "./manifest"

const lead: EntityDefinition = {
    entry: "entity",
    name: "sales.lead",
    dataKind: "sales-lead",
    view: true,
    fields: { name: { kind: "text", nullable: false, maxLength: 200, searchable: true } },
    indexes: [{ name: "recent_idx", on: [{ desc: "updatedAt" }] }],
    constraints: [{ kind: "noOverlap", name: "no_overlap", equal: [], range: ["a", "b"], refusal: "overlap" }],
}

const bare: EntityDefinition = { entry: "entity", name: "chat.message", dataKind: "message", fields: {} }

describe("manifestOf", () => {
    it("lists partition, view, checks and indexes by their normalized names, sorted", () => {
        expect(manifestOf([lead])).toEqual({
            version: 1,
            entities: [
                {
                    entity: "sales.lead",
                    partition: "records_sales_lead",
                    view: "v_records_sales_lead",
                    checks: [
                        "records_data_check",
                        "records_entity_check",
                        "records_sales_lead_name_chk",
                        "records_sales_lead_no_overlap",
                        "records_version_check",
                    ],
                    indexes: ["records_sales_lead_name_trgm_idx", "records_sales_lead_recent_idx"],
                },
            ],
        })
    })

    it("omits what an entity does not have, keeps the checks every partition inherits, and sorts entities by name", () => {
        const manifest = manifestOf([lead, bare])
        expect(manifest.entities.map((entry) => entry.entity)).toEqual(["chat.message", "sales.lead"])
        expect(manifest.entities[0]).toEqual({
            entity: "chat.message",
            partition: "records_chat_message",
            checks: ["records_data_check", "records_entity_check", "records_version_check"],
        })
    })
})
