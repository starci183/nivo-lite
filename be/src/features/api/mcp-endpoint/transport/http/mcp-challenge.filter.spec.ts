import type { ArgumentsHost } from "@nestjs/common"
import { mock } from "@starci/jest-preset"
import type { ErrorsService } from "@modules/platform/errors"
import type { RequestLocale } from "@modules/platform/i18n"
import { MCP_BEARER_CHALLENGE, McpChallengeFilter } from "./mcp-challenge.filter"

const hostOf = () => {
    const response = { setHeader: jest.fn(), status: jest.fn(), json: jest.fn() }
    response.status.mockReturnValue(response)
    const request = { path: "/mcp", method: "POST", headers: {} }
    const host = mock<ArgumentsHost>()
    host.switchToHttp.mockReturnValue({
        getRequest: () => request,
        getResponse: () => response,
        getNext: () => undefined,
    } as unknown as ReturnType<ArgumentsHost["switchToHttp"]>)
    return { host, response }
}

const filterFor = (status: number, code: string) => {
    const errors = mock<ErrorsService>()
    errors.describe.mockReturnValue({ code, kind: status === 401 ? "unauthenticated" : "forbidden", status, params: {} })
    errors.text.mockReturnValue("text")
    const locale = mock<RequestLocale>()
    locale.of.mockReturnValue("en")
    return new McpChallengeFilter(errors, locale)
}

describe("McpChallengeFilter", () => {
    it("answers a missing or revoked key 401 with the Bearer challenge", () => {
        const { host, response } = hostOf()

        filterFor(401, "API_KEYS_REVOKED").catch(new Error("refused"), host)

        expect(response.setHeader).toHaveBeenCalledWith("WWW-Authenticate", MCP_BEARER_CHALLENGE)
        expect(response.status).toHaveBeenCalledWith(401)
        expect(response.json).toHaveBeenCalledWith({ code: "API_KEYS_REVOKED", kind: "unauthenticated", message: "text", params: {} })
    })

    it("answers a key of another workspace 403 without a challenge", () => {
        const { host, response } = hostOf()

        filterFor(403, "MCP_ENDPOINT_WORKSPACE_MISMATCH").catch(new Error("refused"), host)

        expect(response.setHeader).not.toHaveBeenCalled()
        expect(response.status).toHaveBeenCalledWith(403)
    })
})
