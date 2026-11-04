import { getMetadataArgsStorage } from "typeorm"
import { agentMessagesEntities } from "@modules/domain/agent-messages"
import { AbstractEntity } from "@modules/platform/database"

const [AgentMessageEntity] = agentMessagesEntities

/** The insert flag of `createdAt` as declared on a class itself. */
const insertOf = (target: object): boolean | undefined =>
    getMetadataArgsStorage().columns.find(
        (column) => Object.is(column.target, target) && column.propertyName === "createdAt",
    )?.options.insert

describe("AgentMessageEntity createdAt", () => {
    it("takes an outside time on insert on agent messages alone; every other table keeps the database's time", () => {
        expect(insertOf(AgentMessageEntity)).toBe(true)
        expect(insertOf(AbstractEntity)).toBe(false)
    })
})
