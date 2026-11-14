import {
    isActionId,
    isApiVerb,
    isCrmOp,
    isOperationId,
    isQualifiedAction,
    isQualifiedName,
    isQualifiedRead,
    isReadId,
    isToolId,
    isToolName,
    isTriggerVerb,
    levelOf,
    moduleKeyOfName,
    moduleKeyOfOperation,
} from "./namespaced"

/**
 * An id written by its segments: the refused spellings below (an old id, a fifth segment, a wrong level) are spelled this way so the
 * source guard of the renames (`scripts/tool-names-check.mjs`, which refuses any such literal outside history) finds none; the value
 * asserted is the same string.
 */
const dotted = (...segments: ReadonlyArray<string>): string => segments.join(".")

describe("the law of a NIVO verb: nivo.<level>.<1\u20134 segments>", () => {
    it("names the level of a lawful verb", () => {
        expect(levelOf("nivo.tool.customer.message.send")).toBe("tool")
        expect(levelOf("nivo.trigger.clock.tick")).toBe("trigger")
        expect(levelOf("nivo.api.crm.get.customers-code-balance")).toBe("api")
    })

    it("takes one to four segments after the level", () => {
        expect(isToolId("nivo.tool.search")).toBe(true)
        expect(isToolId("nivo.tool.contact.channel.address.update")).toBe(true)
        expect(isToolId(dotted("nivo", "tool", "contact", "channel", "address", "update", "more"))).toBe(false)
        expect(isToolId("nivo.tool")).toBe(false)
    })

    it("refuses an unknown level, an upper case or leading-digit segment and a stray dot", () => {
        expect(levelOf(dotted("nivo", "lead", "message", "send"))).toBeNull()
        expect(levelOf(dotted("nivo", "tools", "lead", "message", "send"))).toBeNull()
        expect(levelOf("nivo.tool.Lead.send")).toBeNull()
        expect(levelOf("nivo.tool.1lead.send")).toBeNull()
        expect(levelOf("nivo.tool.lead..send")).toBeNull()
        expect(levelOf("nivo.tool.lead.send.")).toBeNull()
        expect(levelOf("crm.tool.lead.send")).toBeNull()
    })

    it("tells the three levels apart: a tool is never an api verb or a trigger", () => {
        expect(isToolId("nivo.api.crm.get.tickets")).toBe(false)
        // A CRM operation is the one `nivo.api.*` form a node may call: `nivo.api.crm.<crmId>.<method>.<path>`.
        expect(isCrmOp("nivo.api.crm.nivoweb.patch.orders.code.status")).toBe(true)
        expect(isToolId("nivo.api.crm.nivoweb.get.prices")).toBe(true)
        expect(isApiVerb("nivo.api.crm.nivoweb.patch.orders.code.status")).toBe(true)
        expect(isToolName("nivo.api.crm.nivoweb.get")).toBe(true)
        expect(isCrmOp("nivo.api.crm.nivoweb.fetch.prices")).toBe(false)
        expect(isCrmOp("nivo.api.crm.Nivo.get.prices")).toBe(false)
        expect(isApiVerb("nivo.api.crm.get.tickets")).toBe(true)
        expect(isTriggerVerb("nivo.trigger.lead.message.received")).toBe(true)
        expect(isTriggerVerb("nivo.tool.customer.message.send")).toBe(false)
    })
})

describe("isToolName: where a tool is declared", () => {
    it("holds an id of NIVO's namespace to the law of a tool id", () => {
        expect(isToolName("nivo.tool.order.create")).toBe(true)
        expect(isToolName(dotted("nivo", "order", "create"))).toBe(false)
        expect(isToolName("nivo.api.crm.get.tickets")).toBe(false)
        expect(isToolName("nivo.trigger.clock.tick")).toBe(false)
    })

    it("holds any other id to the registry id grammar", () => {
        expect(isToolName("acme.customer.find")).toBe(true)
        expect(isToolName("Acme.x")).toBe(false)
    })
})

describe("the law of a module read: <package>.<agent>.api.<domain>.<query> or <module>.<name>", () => {
    it("takes the package-qualified form, kebab-case parts and the api segment in third place", () => {
        expect(isQualifiedRead("blocks-core.booking.api.booking.list")).toBe(true)
        expect(isQualifiedRead("blocks-core.video.api.brand-kit.get")).toBe(true)
        expect(isQualifiedRead(dotted("blocks-core", "booking", "booking", "list"))).toBe(false)
        expect(isQualifiedRead(dotted("blocks-core", "booking", "api", "booking"))).toBe(false)
        expect(isQualifiedRead(dotted("blocks-core", "booking", "api", "booking", "list", "more"))).toBe(false)
        expect(isQualifiedRead("Blocks-core.booking.api.booking.list")).toBe(false)
    })

    it("takes a two-part <module>.<name> id of a module not yet qualified, and nothing else", () => {
        expect(isReadId("sales.leads")).toBe(true)
        expect(isReadId("blocks-core.hiring.api.candidate.get")).toBe(true)
        expect(isReadId("leads")).toBe(false)
        expect(isReadId(dotted("a", "b", "c"))).toBe(false)
        expect(isReadId(dotted("a", "b", "c", "d"))).toBe(false)
        expect(isReadId(dotted("a", "b", "c", "d", "e", "f"))).toBe(false)
    })
})

describe("the law of a module action: <package>.<agent>.<action> or <module>.<name>", () => {
    it("takes exactly three kebab-case parts as the package-qualified form", () => {
        expect(isQualifiedAction("blocks-core.booking.booking-confirm")).toBe(true)
        expect(isQualifiedAction("blocks-core.video.project-save")).toBe(true)
        expect(isQualifiedAction(dotted("blocks-core", "booking"))).toBe(false)
        expect(isQualifiedAction(dotted("blocks-core", "booking", "booking", "confirm"))).toBe(false)
        expect(isQualifiedAction("Blocks-core.booking.booking-confirm")).toBe(false)
    })

    it("takes a two-part <module>.<name> id of a module not yet qualified, and nothing else", () => {
        expect(isActionId("sales.cancel-order")).toBe(true)
        expect(isActionId("blocks-core.sales.order-cancel")).toBe(true)
        expect(isActionId("cancel")).toBe(false)
        expect(isActionId(dotted("a", "b", "c", "d"))).toBe(false)
        expect(isActionId("blocks-core.booking.api.booking.list")).toBe(false)
    })
})

describe("the law of a module operation (a read or an action) and its module key", () => {
    it("takes either form and refuses an id of four parts", () => {
        expect(isOperationId("blocks-core.booking.api.booking.list")).toBe(true)
        expect(isOperationId("blocks-core.booking.booking-confirm")).toBe(true)
        expect(isOperationId("sales.cancel-order")).toBe(true)
        expect(isOperationId(dotted("a", "b", "c", "d"))).toBe(false)
        expect(isOperationId("leads")).toBe(false)
    })

    it("reads the module key as the agent of a qualified id (read or action) and the namespace of a two-part id", () => {
        expect(moduleKeyOfOperation("blocks-core.booking.api.booking.list")).toBe("booking")
        expect(moduleKeyOfOperation("blocks-core.booking.booking-confirm")).toBe("booking")
        expect(moduleKeyOfOperation("sales.move-stage")).toBe("sales")
        expect(moduleKeyOfOperation(dotted("a", "b", "c", "d"))).toBe("")
        expect(moduleKeyOfOperation("booking")).toBe("")
    })
})

describe("the module key of an entity or job name", () => {
    it("is the agent of a package-qualified name of three parts", () => {
        expect(isQualifiedName("blocks-core.video.project")).toBe(true)
        expect(moduleKeyOfName("blocks-core.booking.hold-expiry")).toBe("booking")
        expect(moduleKeyOfName("blocks-core.hiring.candidate")).toBe("hiring")
    })

    it("is the first part of an old-form <module>.<thing> name", () => {
        expect(isQualifiedName("loyalty.member")).toBe(false)
        expect(moduleKeyOfName("loyalty.member")).toBe("loyalty")
        expect(moduleKeyOfName("accounting.book-entry")).toBe("accounting")
        expect(moduleKeyOfName("hiring")).toBe("hiring")
    })
})
