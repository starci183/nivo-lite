import { builder } from "@starci/jest-preset"
import type { GetAdminSessionResult } from "../../application/get-admin-session.contracts"
import { toGetAdminSessionRequest, toGetAdminSessionResponse } from "./get-admin-session.mapper"

const resultOf = builder<GetAdminSessionResult>({ userId: "admin-1", email: "admin@example.test" })

describe("get-admin-session mapper", () => {
    it("creates the empty session request", () => {
        expect(toGetAdminSessionRequest()).toEqual({})
    })

    it("exposes the email without the internal user id", () => {
        const result = resultOf()
        const response = toGetAdminSessionResponse(result)

        expect(response).toEqual({ email: "admin@example.test" })
        expect(response).not.toBe(result)
    })
})
