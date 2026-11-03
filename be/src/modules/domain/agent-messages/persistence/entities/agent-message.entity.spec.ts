import { getMetadataArgsStorage } from "typeorm"
import { UuidAbstractEntity } from "@modules/platform/database"
import { AgentMessageEntity } from "./agent-message.entity"

/** The insert flag of `createdAt` as declared on a class itself. */
const insertOf = (target: object): boolean | undefined =>
    getMetadataArgsStorage().columns.find((column) => column.target === target && column.propertyName === "createdAt")
        ?.options.insert

describe("AgentMessageEntity createdAt", () => {
    it("takes an outside time on insert on agent messages alone; every other table keeps the database's time", () => {
        expect(insertOf(AgentMessageEntity)).toBe(true)
        expect(insertOf(Object.getPrototypeOf(UuidAbstractEntity) as object)).toBe(false)
    })
})
