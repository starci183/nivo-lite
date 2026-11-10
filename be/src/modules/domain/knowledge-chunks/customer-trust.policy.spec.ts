import { readFileSync } from "node:fs"
import { join } from "node:path"
import { Test } from "@nestjs/testing"
import {
    CUSTOMER_READY_COLUMN,
    customerReadyOf,
    customerReadySelect,
    customerTrustWhere,
    isUnreviewed,
} from "./customer-trust.policy"

const SUBJECT = Symbol("customer-trust.policy")
type Subject = { customerTrustWhere: typeof customerTrustWhere; customerReadyOf: typeof customerReadyOf }
const buildSubject = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { customerTrustWhere, customerReadyOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

/** The migration that adds the gate (repo root db/migrations, four levels above be/src/modules/domain). */
const MIGRATION = readFileSync(
    join(__dirname, "..", "..", "..", "..", "..", "db", "migrations", "20261112013200_shop-document-critic.sql"),
    "utf8",
)

describe("customer trust gate", () => {
    it("a customer search reads served passages only; an internal search (agents inside, the founder's 'Hoi thu') reads all, marked unreviewed", async () => {
        const subject = await buildSubject()
        expect(subject.customerTrustWhere("c", "customer")).toBe("c.customer_ready = true")
        expect(subject.customerTrustWhere("c", "internal")).toBeNull()
        expect(customerReadySelect("c")).toBe("c.customer_ready")
        expect([isUnreviewed(true), isUnreviewed(false), isUnreviewed(null)]).toEqual([false, true, true])
    })

    it("a passage is served once a finished critique read it (or the founder released the version) and no open high point holds it", async () => {
        const subject = await buildSubject()
        const gate = { reviewed: new Set(["a", "b"]), held: new Set(["b"]), released: false }
        expect(["a", "b", "c"].map((hash) => subject.customerReadyOf(hash, gate))).toEqual([true, false, false])
        expect(["a", "b", "c"].map((hash) => subject.customerReadyOf(hash, { ...gate, released: true }))).toEqual([true, false, true])
    })

    it("is index-served: the customer filter is exactly the predicate of the partial index the migration creates, and new rows start withheld while old rows stay served", () => {
        const index = /CREATE INDEX knowledge_chunks_customer ON public\.knowledge_chunks USING btree \(workspace_id\) WHERE visibility = 'public' AND (\w+);/u.exec(MIGRATION)
        expect(index?.[1]).toBe(CUSTOMER_READY_COLUMN)
        expect(MIGRATION).toContain(`ADD COLUMN ${CUSTOMER_READY_COLUMN} boolean NOT NULL DEFAULT true;`)
        expect(MIGRATION).toContain(`ALTER COLUMN ${CUSTOMER_READY_COLUMN} SET DEFAULT false;`)
    })
})
