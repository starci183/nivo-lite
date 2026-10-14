import { COMMAND_KINDS, commandOf } from "./command-payload.policy"

const FACT = {
    subjectType: "business",
    subjectLabel: "Shop",
    attributeLabel: "Hours",
    value: "8am to 9pm",
    scope: "restricted",
}

describe("commandOf", () => {
    it("names every command the pages may request", () => {
        expect(COMMAND_KINDS).toEqual([
            "fact.save",
            "fact.decide",
            "fact.keep",
            "lesson.save",
            "lesson.decide",
            "gap.dismiss",
            "brain.maintain",
            "lessons.mine",
            "source.delete",
            "source.reindex",
            "source.update",
            "knowledge.reembed",
            "knowledge.ask",
            "drive.linked",
            "drive.picked",
        ])
    })

    it("refuses an unknown kind", () => {
        expect(commandOf("fact.remove", {})).toBeNull()
    })

    it.each<[unknown]>([[null], [undefined], [[]], ["payload"], [7]])("refuses a non-object payload %p", (payload) => {
        expect(commandOf("brain.maintain", payload)).toBeNull()
    })

    describe("fact.save", () => {
        it("keeps every fact field and omits unrelated fields", () => {
            expect(
                commandOf("fact.save", {
                    ...FACT,
                    modules: ["sales", "support"],
                    validFrom: "2026-10-01",
                    validTo: "2026-10-31",
                    note: "October hours",
                    gapId: "gap-1",
                    workspaceId: "untrusted",
                }),
            ).toEqual({
                kind: "fact.save",
                form: {
                    ...FACT,
                    modules: ["sales", "support"],
                    validFrom: "2026-10-01",
                    validTo: "2026-10-31",
                    note: "October hours",
                    gapId: "gap-1",
                },
            })
        })

        it.each<[unknown]>([[undefined], ["sales"], [["sales", 1]]])(
            "defaults invalid modules %p to an empty list",
            (modules) => {
                expect(commandOf("fact.save", { ...FACT, modules })).toEqual({
                    kind: "fact.save",
                    form: {
                        ...FACT,
                        modules: [],
                        validFrom: undefined,
                        validTo: undefined,
                        note: undefined,
                        gapId: undefined,
                    },
                })
            },
        )

        it.each(["subjectType", "scope", "subjectLabel", "attributeLabel", "value"])(
            "requires a text %s field",
            (field) => {
                expect(commandOf("fact.save", { ...FACT, [field]: undefined })).toBeNull()
            },
        )

        it("refuses unknown subject types and scopes", () => {
            expect(commandOf("fact.save", { ...FACT, subjectType: "unknown" })).toBeNull()
            expect(commandOf("fact.save", { ...FACT, scope: "private" })).toBeNull()
        })
    })

    it.each(["apply", "reject", "choose", "split", "retire"])("reads fact decision %s", (action) => {
        expect(commandOf("fact.decide", { id: "fact-1", action, note: "Reason", situation: "Weekends" })).toEqual({
            kind: "fact.decide",
            decision: { id: "fact-1", action, note: "Reason", situation: "Weekends" },
        })
    })

    it("reads a fact decision without optional text", () => {
        expect(commandOf("fact.decide", { id: "fact-1", action: "apply", note: 4 })).toEqual({
            kind: "fact.decide",
            decision: { id: "fact-1", action: "apply", note: undefined, situation: undefined },
        })
    })

    it("reads the key and optional installation whose current fact is kept", () => {
        expect(commandOf("fact.keep", { subjectKey: "shop", attribute: "hours", installationId: "agent-1" })).toEqual({
            kind: "fact.keep",
            keep: { subjectKey: "shop", attribute: "hours", installationId: "agent-1" },
        })
        expect(commandOf("fact.keep", { subjectKey: "shop", attribute: "hours" })).toEqual({
            kind: "fact.keep",
            keep: { subjectKey: "shop", attribute: "hours", installationId: undefined },
        })
    })

    it("reads a lesson form with its optional context", () => {
        expect(
            commandOf("lesson.save", { module: "sales", title: "Confirm", body: "Ask first", appliesWhen: "Unsure" }),
        ).toEqual({
            kind: "lesson.save",
            form: { module: "sales", title: "Confirm", body: "Ask first", appliesWhen: "Unsure" },
        })
        expect(commandOf("lesson.save", { title: "Confirm", body: "Ask first" })).toEqual({
            kind: "lesson.save",
            form: { module: undefined, title: "Confirm", body: "Ask first", appliesWhen: undefined },
        })
    })

    it.each(["active", "rejected", "retired"])("reads lesson decision %s", (action) => {
        expect(commandOf("lesson.decide", { id: "lesson-1", action })).toEqual({
            kind: "lesson.decide",
            decision: { id: "lesson-1", action },
        })
    })

    it("reads gap, mining, deletion, and maintenance commands", () => {
        expect(commandOf("gap.dismiss", { id: "gap-1" })).toEqual({ kind: "gap.dismiss", id: "gap-1" })
        expect(commandOf("lessons.mine", { module: "sales" })).toEqual({ kind: "lessons.mine", module: "sales" })
        expect(commandOf("source.delete", { sourceId: "source-1" })).toEqual({
            kind: "source.delete",
            sourceId: "source-1",
        })
        expect(commandOf("brain.maintain", {})).toEqual({ kind: "brain.maintain" })
        expect(commandOf("knowledge.reembed", {})).toEqual({ kind: "knowledge.reembed" })
    })

    it("reads replacement text only when it is text", () => {
        expect(commandOf("source.reindex", { sourceId: "source-1", content: "New text" })).toEqual({
            kind: "source.reindex",
            reindex: { sourceId: "source-1", content: "New text" },
        })
        expect(commandOf("source.reindex", { sourceId: "source-1", content: null })).toEqual({
            kind: "source.reindex",
            reindex: { sourceId: "source-1", content: undefined },
        })
    })

    it("reads all source metadata and preserves empty values used for clearing", () => {
        expect(
            commandOf("source.update", {
                sourceId: "source-1",
                title: "Guide",
                topic: "",
                tags: ["help", "sales"],
                module: "",
                visibility: "internal",
            }),
        ).toEqual({
            kind: "source.update",
            update: {
                sourceId: "source-1",
                title: "Guide",
                topic: "",
                tags: ["help", "sales"],
                module: "",
                visibility: "internal",
            },
        })
        expect(commandOf("source.update", { sourceId: "source-1", tags: [1] })).toEqual({
            kind: "source.update",
            update: {
                sourceId: "source-1",
                title: undefined,
                topic: undefined,
                tags: undefined,
                module: undefined,
                visibility: undefined,
            },
        })
    })

    it("reads a knowledge question and both kinds of Drive folder reference", () => {
        expect(commandOf("knowledge.ask", { question: "Hours?", module: "sales", audience: "customer" })).toEqual({
            kind: "knowledge.ask",
            ask: { question: "Hours?", module: "sales", audience: "customer" },
        })
        expect(commandOf("drive.linked", { url: "https://drive.example/folder" })).toEqual({
            kind: "drive.linked",
            url: "https://drive.example/folder",
        })
        expect(commandOf("drive.picked", { folderId: "folder-1", token: "picker-token" })).toEqual({
            kind: "drive.picked",
            picked: { folderId: "folder-1", token: "picker-token" },
        })
    })

    it.each<[string, object]>([
        ["fact.decide", { action: "apply" }],
        ["fact.decide", { id: "fact-1", action: "invalid" }],
        ["fact.keep", { attribute: "hours" }],
        ["fact.keep", { subjectKey: "shop" }],
        ["lesson.save", { body: "Ask first" }],
        ["lesson.save", { title: "Confirm" }],
        ["lesson.decide", { action: "active" }],
        ["lesson.decide", { id: "lesson-1", action: "invalid" }],
        ["gap.dismiss", {}],
        ["lessons.mine", {}],
        ["source.delete", {}],
        ["source.reindex", {}],
        ["source.update", {}],
        ["knowledge.ask", { module: "sales", audience: "customer" }],
        ["knowledge.ask", { question: "Hours?", audience: "customer" }],
        ["knowledge.ask", { question: "Hours?", module: "sales" }],
        ["drive.linked", {}],
        ["drive.picked", { token: "picker-token" }],
        ["drive.picked", { folderId: "folder-1" }],
    ])("refuses %s when a required field is missing or invalid: %p", (kind, payload) => {
        expect(commandOf(kind, payload)).toBeNull()
    })
})
