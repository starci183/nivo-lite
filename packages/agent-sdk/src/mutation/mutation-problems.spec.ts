import { entityOf, mutationProblems } from "./mutation-problems"
import { entities, LEAD_ID, MEMBER_ID, VERSION } from "./mutation.fixture"
import type { Mutation, MutationBy, MutationLinks, MutationValues } from "./mutation.types"

const codes = (mutation: Mutation, by: MutationBy = "action"): Array<string> =>
    mutationProblems(mutation, entities, by).map((p) => `${p.code} ${p.at}`)
const OWNER: MutationLinks = { owner: MEMBER_ID }
const insert = (values: MutationValues, links = OWNER): Mutation => ({
    op: "insert",
    entity: "demo.lead",
    values,
    links,
})

describe("entityOf", () => {
    it("finds a declared entity by name", () => {
        expect(entityOf(entities, "demo.run")?.name).toBe("demo.run")
        expect(entityOf(entities, "demo.none")).toBeUndefined()
    })
})

describe("mutationProblems: insert", () => {
    it("accepts a complete record", () => {
        expect(codes(insert({ name: "Anh", phone: null }))).toEqual([])
    })

    it("refuses an unknown entity", () => {
        expect(codes({ op: "insert", entity: "demo.none", values: {} })).toEqual(["MUTATION_ENTITY_UNKNOWN demo.none"])
    })

    it("refuses the workspace field as the owner and the other system fields as system", () => {
        expect(codes(insert({ name: "a", workspaceId: MEMBER_ID }))).toEqual([
            "MUTATION_OWNER_FIELD demo.lead.workspaceId",
        ])
        expect(codes(insert({ name: "a", id: LEAD_ID, version: "1", createdAt: "x", updatedAt: "y" }))).toEqual([
            "MUTATION_SYSTEM_FIELD demo.lead.id",
            "MUTATION_SYSTEM_FIELD demo.lead.version",
            "MUTATION_SYSTEM_FIELD demo.lead.createdAt",
            "MUTATION_SYSTEM_FIELD demo.lead.updatedAt",
        ])
    })

    it("refuses sequence and unknown fields", () => {
        expect(codes(insert({ name: "a", orderNo: "DH-1" }))).toEqual(["MUTATION_FIELD_SEQUENCE demo.lead.orderNo"])
        expect(codes(insert({ name: "a", toString: "x", nope: 1 }))).toEqual([
            "MUTATION_FIELD_UNKNOWN demo.lead.toString",
            "MUTATION_FIELD_UNKNOWN demo.lead.nope",
        ])
    })

    it("refuses a value off its kind, bounds or jsonb shape", () => {
        expect(codes(insert({ name: "x".repeat(11) }))).toEqual(["MUTATION_VALUE_INVALID demo.lead.name"])
        expect(codes(insert({ name: "a", data: { tag: "toolong" } }))).toEqual([
            "MUTATION_VALUE_INVALID demo.lead.data",
        ])
        expect(codes(insert({ name: "a", data: { tag: "ok" } }))).toEqual([])
    })

    it("names the required field a created record misses", () => {
        expect(codes(insert({}))).toEqual(["MUTATION_FIELD_MISSING demo.lead.name"])
    })

    it("links toOne relations: required present, optional allowed, unknown, toMany and malformed refused", () => {
        expect(codes(insert({ name: "a" }, { owner: MEMBER_ID, source: MEMBER_ID }))).toEqual([])
        expect(codes({ op: "insert", entity: "demo.lead", values: { name: "a" } })).toEqual([
            "MUTATION_LINK_MISSING demo.lead.owner",
        ])
        expect(codes({ op: "insert", entity: "demo.lead", values: { name: "a" }, links: {} })).toEqual([
            "MUTATION_LINK_MISSING demo.lead.owner",
        ])
        expect(
            codes({ op: "insert", entity: "demo.lead", values: { name: "a" }, links: { ...OWNER, nope: MEMBER_ID } }),
        ).toEqual(["MUTATION_RELATION_UNKNOWN demo.lead.nope"])
        expect(
            codes({ op: "insert", entity: "demo.lead", values: { name: "a" }, links: { ...OWNER, notes: MEMBER_ID } }),
        ).toEqual(["MUTATION_RELATION_NOT_TO_ONE demo.lead.notes"])
        expect(codes({ op: "insert", entity: "demo.lead", values: { name: "a" }, links: { owner: "x" } })).toEqual([
            "MUTATION_LINK_INVALID demo.lead.owner",
        ])
    })
})

describe("mutationProblems: projection", () => {
    const book: Mutation = { op: "insert", entity: "demo.book", values: { note: "n" } }

    it("is written by a job and refused for an action", () => {
        expect(codes(book, "job")).toEqual([])
        expect(codes(book, "action")).toEqual(["MUTATION_PROJECTION_WRITE demo.book"])
    })
})

describe("mutationProblems: update and delete", () => {
    const update = (values: MutationValues, key = LEAD_ID): Mutation => ({
        op: "update",
        entity: "demo.lead",
        key,
        expected: VERSION,
        values,
    })

    it("accepts a partial update and refuses an empty one", () => {
        expect(codes(update({ name: "b" }))).toEqual([])
        expect(codes(update({}))).toEqual(["MUTATION_VALUES_EMPTY demo.lead"])
    })

    it("refuses a key that is no uuid", () => {
        expect(codes(update({ name: "b" }, "nope"))).toEqual(["MUTATION_KEY_INVALID demo.lead"])
    })

    it("deletes only a deletable entity", () => {
        expect(codes({ op: "delete", entity: "demo.run", key: LEAD_ID })).toEqual([])
        expect(codes({ op: "delete", entity: "demo.lead", key: LEAD_ID })).toEqual(["MUTATION_NOT_DELETABLE demo.lead"])
        expect(codes({ op: "delete", entity: "demo.run", key: "nope" })).toEqual(["MUTATION_KEY_INVALID demo.run"])
    })
})

describe("mutationProblems: link and unlink", () => {
    const link = (op: "link" | "unlink", relation: string, to = MEMBER_ID, key = LEAD_ID): Mutation => ({
        op,
        entity: "demo.lead",
        key,
        relation,
        to,
    })

    it("links and unlinks over declared relations", () => {
        expect(codes(link("link", "notes"))).toEqual([])
        expect(codes(link("unlink", "notes"))).toEqual([])
        expect(codes(link("link", "owner"))).toEqual([])
        expect(codes(link("unlink", "source"))).toEqual([])
    })

    it("refuses an unknown relation, a bad id on either end and the unlink of a required relation", () => {
        expect(codes(link("link", "nope"))).toEqual(["MUTATION_RELATION_UNKNOWN demo.lead.nope"])
        expect(codes(link("link", "notes", "x", "y"))).toEqual([
            "MUTATION_KEY_INVALID demo.lead",
            "MUTATION_LINK_INVALID demo.lead.notes",
        ])
        expect(codes(link("unlink", "owner"))).toEqual(["MUTATION_LINK_REQUIRED demo.lead.owner"])
    })
})

describe("mutationProblems: upsert and ensure", () => {
    it("upserts on a declared unique constraint with its key values given", () => {
        expect(
            codes({ op: "upsert", entity: "demo.lead", on: "lead_phone", values: { name: "a", phone: "09" } }),
        ).toEqual([])
    })

    it("refuses an unknown or non-unique constraint", () => {
        expect(codes({ op: "upsert", entity: "demo.lead", on: "lead_name_check", values: { name: "a" } })).toEqual([
            "MUTATION_UNIQUE_UNKNOWN demo.lead.lead_name_check",
        ])
        expect(codes({ op: "upsert", entity: "demo.run", on: "x", values: {} })).toEqual([
            "MUTATION_UNIQUE_UNKNOWN demo.run.x",
        ])
    })

    it("refuses a key value that is missing or null, since such a key never matches", () => {
        expect(codes({ op: "upsert", entity: "demo.lead", on: "lead_phone", values: { name: "a" } })).toEqual([
            "MUTATION_KEY_VALUE_MISSING demo.lead.phone",
        ])
        expect(
            codes({ op: "upsert", entity: "demo.lead", on: "lead_phone", values: { name: "a", phone: null } }),
        ).toEqual(["MUTATION_KEY_VALUE_MISSING demo.lead.phone"])
    })

    it("ensures by a declared match key", () => {
        expect(
            codes({ op: "ensure", entity: "demo.lead", match: "by_phone", values: { name: "a", phone: "09" } }),
        ).toEqual([])
        expect(codes({ op: "ensure", entity: "demo.lead", match: "by_email", values: { name: "a" } })).toEqual([
            "MUTATION_MATCH_KEY_UNKNOWN demo.lead.by_email",
        ])
        expect(codes({ op: "ensure", entity: "demo.run", match: "by_phone", values: {} })).toEqual([
            "MUTATION_MATCH_KEY_UNKNOWN demo.run.by_phone",
        ])
        expect(codes({ op: "ensure", entity: "demo.lead", match: "by_phone", values: { name: "a" } })).toEqual([
            "MUTATION_KEY_VALUE_MISSING demo.lead.phone",
        ])
    })
})
