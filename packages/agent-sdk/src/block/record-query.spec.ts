import { z } from "zod"
import { defineEntity, field } from "../entity/entity"
import { entityPortIdOf } from "../entity/port/entity-port"
import type { EntityApi, ListPage, RecordRow } from "../entity/port/entity-port.types"
import type { PortDefinition, PortProvider, RunContext } from "../port/port.types"
import { SdkDefinitionError } from "./definition-error"
import { defineRecordQuery } from "./record-query"

const order = defineEntity({
    name: "blocks-core.sales.order",
    dataKind: "sales-order",
    fields: { code: field.text({ maxLength: 20 }), status: field.enum({ of: ["draft", "paid"] }) },
})

const ROW: RecordRow = {
    id: "00000000-0000-4000-8000-000000000001",
    workspaceId: "00000000-0000-4000-8000-000000000009",
    version: "1",
    createdAt: "2026-11-13T00:00:00.000Z",
    updatedAt: "2026-11-13T00:00:00.000Z",
    data: { code: "A1", status: "paid" },
}

const CONTEXT: RunContext = {
    workspaceId: ROW.workspaceId,
    memberId: null,
    now: new Date("2026-11-13T00:00:00.000Z"),
    timeZone: "Asia/Ho_Chi_Minh",
    locale: "vi",
}

/** A provider whose only port is the order type's, recording the query it was asked. */
const providerOf = (asked: Array<unknown>): PortProvider => {
    const api: Partial<EntityApi> = {
        list: (query): Promise<ListPage> => {
            asked.push(query)
            return Promise.resolve({ rows: [{ row: ROW, joined: {}, position: [], included: {} }], next: "next-1" })
        },
        get: (id) => {
            asked.push(id)
            return Promise.resolve(ROW)
        },
    }
    return {
        implementationOf: (port: PortDefinition<unknown>) => {
            if (port.id !== entityPortIdOf(order.name)) throw new SdkDefinitionError("PORT_UNPROVIDED", port.id)
            return api
        },
    }
}

const BASE = {
    dataKind: "sales-order",
    fields: ["id", "code", "status"],
    paths: { rows: "list" },
    permission: "sales.view",
} as const

const thrown = (make: () => unknown): unknown => {
    try {
        make()
    } catch (error) {
        return error
    }
    return null
}

describe("defineRecordQuery: a declarative read over one record type of the read's own agent", () => {
    it("runs the declared list over the type's port and answers the rows and the next cursor", async () => {
        const read = defineRecordQuery({
            ...BASE,
            id: "blocks-core.sales.api.order.list",
            shape: "list",
            type: order,
            variables: z.object({ status: z.enum(["draft", "paid"]) }),
            list: ({ status }) => ({
                select: ["code", "status"],
                where: { op: "eq", field: "status", value: status },
                order: [["id", "desc"]],
                page: { size: 20 },
            }),
        })
        expect(read.entry).toBe("read")
        expect(read.operation).toBe("blocks-core.sales.api.order.list")
        expect(read.ports).toEqual({ records: { entry: "port", id: entityPortIdOf(order.name) } })
        const asked: Array<unknown> = []
        await expect(read.execute?.(providerOf(asked), { status: "paid" }, CONTEXT)).resolves.toEqual({
            ok: true,
            data: { rows: [ROW], cursor: "next-1" },
        })
        expect(asked).toEqual([
            {
                select: ["code", "status"],
                where: { op: "eq", field: "status", value: "paid" },
                order: [["id", "desc"]],
                page: { size: 20 },
            },
        ])
    })

    it("runs a get by the id the variables name, through the view when one is declared", async () => {
        const read = defineRecordQuery({
            ...BASE,
            id: "blocks-core.sales.api.order.get",
            shape: "record",
            paths: {},
            type: order,
            variables: z.object({ id: z.string().max(40) }),
            get: ({ id }) => id,
            view: (row) => ({ id: row.id, code: row.data["code"] }),
        })
        const asked: Array<unknown> = []
        await expect(read.execute?.(providerOf(asked), { id: ROW.id }, CONTEXT)).resolves.toEqual({
            ok: true,
            data: { id: ROW.id, code: "A1" },
        })
        expect(asked).toEqual([ROW.id])
    })

    it("refuses an id that is not <package>.<agent>.api.<domain>.<query>", () => {
        expect(
            thrown(() =>
                defineRecordQuery({ ...BASE, id: "sales.orders", shape: "list", type: order, variables: z.object({}), get: () => "" }),
            ),
        ).toMatchObject({ code: "ID_MALFORMED" })
    })

    it("refuses a query over a type of another agent (RECORD_QUERY_OTHER_AGENT)", () => {
        expect(
            thrown(() =>
                defineRecordQuery({
                    ...BASE,
                    id: "blocks-core.chatbot.api.order.list",
                    shape: "list",
                    type: order,
                    variables: z.object({}),
                    get: () => "",
                }),
            ),
        ).toMatchObject({ code: "RECORD_QUERY_OTHER_AGENT" })
    })
})
