import { builder } from "@starci/jest-preset"
import type { SaveContractResult } from "../../application/save-contract.contracts"
import type { SaveContractRequest } from "./dto/save-contract.request"
import { toSaveContractRequest, toSaveContractResponse } from "./save-contract.mapper"

const requestOf = builder<SaveContractRequest>({
    contractId: "contract-1",
    leadId: "lead-1",
    customerName: "An",
    plan: "Pro",
    startsOn: "2026-10-13",
    endsOn: "2027-10-12",
    amountVnd: 500000,
    status: "active",
    note: "Annual contract",
})
const resultOf = builder<SaveContractResult>({
    id: "contract-1",
    leadId: "lead-1",
    customerName: "An",
    plan: "Pro",
    startsOn: "2026-10-13",
    endsOn: "2027-10-12",
    amountVnd: 500000,
    status: "active",
    note: "Annual contract",
})

describe("save-contract mapper", () => {
    it("copies every contract field and adds the workspace and language", () => {
        expect(toSaveContractRequest("workspace-1", requestOf(), "en")).toEqual({
            contractId: "contract-1",
            leadId: "lead-1",
            customerName: "An",
            plan: "Pro",
            startsOn: "2026-10-13",
            endsOn: "2027-10-12",
            amountVnd: 500000,
            status: "active",
            note: "Annual contract",
            workspaceId: "workspace-1",
            acceptLanguage: "en",
        })
    })

    it("preserves null ids, an unknown amount and an absent language for a new contract", () => {
        expect(
            toSaveContractRequest(
                "workspace-2",
                requestOf({ contractId: null, leadId: null, amountVnd: null }),
                undefined,
            ),
        ).toEqual({
            contractId: null,
            leadId: null,
            customerName: "An",
            plan: "Pro",
            startsOn: "2026-10-13",
            endsOn: "2027-10-12",
            amountVnd: null,
            status: "active",
            note: "Annual contract",
            workspaceId: "workspace-2",
            acceptLanguage: undefined,
        })
    })

    it("copies every saved contract field into a separate response", () => {
        const result = resultOf()
        const response = toSaveContractResponse(result)

        expect(response).toEqual({
            id: "contract-1",
            leadId: "lead-1",
            customerName: "An",
            plan: "Pro",
            startsOn: "2026-10-13",
            endsOn: "2027-10-12",
            amountVnd: 500000,
            status: "active",
            note: "Annual contract",
        })
        expect(response).not.toBe(result)
    })

    it("preserves null result values", () => {
        expect(toSaveContractResponse(resultOf({ leadId: null, amountVnd: null }))).toEqual({
            id: "contract-1",
            leadId: null,
            customerName: "An",
            plan: "Pro",
            startsOn: "2026-10-13",
            endsOn: "2027-10-12",
            amountVnd: null,
            status: "active",
            note: "Annual contract",
        })
    })
})
