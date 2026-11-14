import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { EINVOICE_MANIFEST } from "./adapters/einvoice-native.service"
import { SEPAY_MANIFEST } from "./adapters/sepay-native.service"
import { ROLE_FAMILY_MANIFESTS as ROLE_FAMILY_MANIFESTSSubject, roleReadinessOf as roleReadinessOfSubject } from "./capability-roles.policy"

const SUBJECT = Symbol("capability-roles.policy")

const build = async (): Promise<{ ROLE_FAMILY_MANIFESTS: typeof ROLE_FAMILY_MANIFESTSSubject; roleReadinessOf: typeof roleReadinessOfSubject }> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: mock<{ ROLE_FAMILY_MANIFESTS: typeof ROLE_FAMILY_MANIFESTSSubject; roleReadinessOf: typeof roleReadinessOfSubject }>({ ROLE_FAMILY_MANIFESTS: ROLE_FAMILY_MANIFESTSSubject, roleReadinessOf: roleReadinessOfSubject }) }],
    }).compile()
    return moduleRef.get<{ ROLE_FAMILY_MANIFESTS: typeof ROLE_FAMILY_MANIFESTSSubject; roleReadinessOf: typeof roleReadinessOfSubject }>(SUBJECT)
}

const PROVIDERS = {
    "identity.find": [],
    "identity.upsert": [],
    "receivable.find": [],
    "receivable.recordPayment": [],
    "payment.debits.list": ["SePay"],
    "payment.credits.list": ["SePay"],
    "invoice.list": ["E-invoices (TT78)"],
}

describe("roleReadinessOf: whether the code plays the roles a module requires (a fact of the build, read from the manifests)", () => {
    let ROLE_FAMILY_MANIFESTS: typeof ROLE_FAMILY_MANIFESTSSubject
    let roleReadinessOf: typeof roleReadinessOfSubject

    beforeAll(async () => {
        ;({ ROLE_FAMILY_MANIFESTS, roleReadinessOf } = await build())
    })

    it("names the families that declare a role: the gateway's own SePay and e-invoice families", () => {
        expect(ROLE_FAMILY_MANIFESTS.map((manifest) => manifest.key)).toEqual([SEPAY_MANIFEST.key, EINVOICE_MANIFEST.key])
    })

    it("is ready for roles a family plays, with every role's providers by display name", () => {
        expect(roleReadinessOf(["payment.credits.list", "invoice.list"])).toEqual({ ready: true, missing: [], providers: PROVIDERS })
    })

    it("names the roles no family plays", () => {
        expect(roleReadinessOf(["payment.credits.list", "receivable.find"])).toEqual({
            ready: false,
            missing: ["receivable.find"],
            providers: PROVIDERS,
        })
    })

    it("is ready when no role is asked", () => {
        expect(roleReadinessOf([])).toMatchObject({ ready: true, missing: [] })
    })
})
