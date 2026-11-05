import { defineEntity, field } from "../entity"
import { ENTITIES_PORT, ENTITIES_PORT_ID, ENTITY_PORT_PREFIX, entityPort, entityPortIdOf } from "./entity-port"

const lead = defineEntity({
    name: "sales.lead",
    dataKind: "sales-lead",
    fields: { title: field.text({ maxLength: 80 }) },
})

describe("entityPortIdOf", () => {
    it("prefixes the entity name", () => {
        expect(ENTITY_PORT_PREFIX).toBe("engine.entity.")
        expect(entityPortIdOf("sales.lead")).toBe("engine.entity.sales.lead")
    })
})

describe("ENTITIES_PORT", () => {
    it("is the engine.entities port", () => {
        expect(ENTITIES_PORT_ID).toBe("engine.entities")
        expect(ENTITIES_PORT).toEqual({ entry: "port", id: "engine.entities" })
    })
})

describe("entityPort", () => {
    it("declares the port bound to the entity", () => {
        expect(entityPort(lead)).toEqual({ entry: "port", id: "engine.entity.sales.lead" })
    })
})
