import { mock } from "@starci/jest-preset"
import type { HttpClient } from "@modules/platform/http"
import {
    FAKE_KEY,
    INET_PORTAL_AVAILABLE,
    INET_PORTAL_DOMAIN_DETAIL,
    INET_PORTAL_DOMAIN_PAGE,
    INET_PORTAL_RECORDS,
    INET_RESELLER_DOMAIN_PAGE,
    inetOk,
    inetRefused,
} from "@tests/fixtures/builders/domain-registrars.builder"
import { InetErrorCode } from "./errors/inet.error"
import {
    InetClient,
    inetDataOf,
    inetRequestOf,
    portalAvailabilityOf,
    portalDomainDetailOf,
    portalDomainPageOf,
    portalRecordsOf,
    resellerDomainRefsOf,
} from "./inet.client"
import { INET_OPS } from "./inet.operations"
import type { InetOptions } from "./inet.options"
import { causeFactsOf } from "@tests/fixtures/builders/cause-facts.builder"

const options: InetOptions = { apiBase: "https://developers.inet.vn/api/gateway/v1", timeoutMs: 4000 }
const BASE = options.apiBase
const AUTH = { Authorization: `Bearer ${FAKE_KEY}` }

const codeOf = (work: () => unknown): unknown => {
    try {
        work()
    } catch (cause) {
        return causeFactsOf(cause).code
    }
    return undefined
}

const paramsOf = (work: () => unknown): unknown => {
    try {
        work()
    } catch (cause) {
        return causeFactsOf(cause).params
    }
    return undefined
}

describe("inetRequestOf, the request of each operation (https://developers.inet.vn/api-reference)", () => {
    it.each([
        [
            "portal availability: GET /domain/check-available?name",
            INET_OPS.portalAvailability,
            { query: { name: "mywebsite.vn" } },
            { method: "GET", url: `${BASE}/domain/check-available?name=mywebsite.vn` },
        ],
        [
            "portal list: GET /domain with name, page from 1, pageSize",
            INET_OPS.portalDomainList,
            { query: { name: "example.vn", page: "1", pageSize: "20" } },
            { method: "GET", url: `${BASE}/domain?name=example.vn&page=1&pageSize=20` },
        ],
        [
            "portal detail: GET /domain/{domainId}",
            INET_OPS.portalDomainGet,
            { path: { domainId: "123456" } },
            { method: "GET", url: `${BASE}/domain/123456` },
        ],
        [
            "portal records: GET /domain/{domainId}/record",
            INET_OPS.portalRecordList,
            { path: { domainId: "123456" } },
            { method: "GET", url: `${BASE}/domain/123456/record` },
        ],
        [
            "reseller list: GET /reseller/domains",
            INET_OPS.resellerDomainList,
            { query: { name: "example.vn", page: "1", pageSize: "20" } },
            { method: "GET", url: `${BASE}/reseller/domains?name=example.vn&page=1&pageSize=20` },
        ],
        [
            "reseller records: GET /reseller/domains/{id}/records",
            INET_OPS.resellerRecordList,
            { path: { id: "123456" } },
            { method: "GET", url: `${BASE}/reseller/domains/123456/records` },
        ],
    ])("%s, the key in Authorization: Bearer, no body", (_label, operation, call, expected) => {
        const request = inetRequestOf(options, FAKE_KEY, operation, call)
        expect(request).toEqual({ ...expected, headers: AUTH, timeoutMs: 4000 })
        expect("body" in request).toBe(false)
    })

    it.each([
        [
            "reseller register: POST /reseller/domains (the documentation's own example body)",
            INET_OPS.resellerRegister,
            {
                body: {
                    name: "test.vn",
                    period: 1,
                    customerId: 1,
                    nsList: [{ hostname: "ns1.inet.vn" }, { hostname: "ns2.inet.vn" }],
                    contacts: [{ fullname: "C\u00F4ng ty A", organization: true, type: "registrant" }],
                },
            },
            "POST",
            `${BASE}/reseller/domains`,
        ],
        [
            "reseller renew: POST /reseller/domains/{id}/renew { period }",
            INET_OPS.resellerRenew,
            { path: { id: "123456" }, body: { period: 1 } },
            "POST",
            `${BASE}/reseller/domains/123456/renew`,
        ],
        [
            "reseller nameservers: PUT /reseller/domains/{id}/nameservers { nsList }",
            INET_OPS.resellerNameserverUpdate,
            { path: { id: "123456" }, body: { nsList: [{ hostname: "ns3.inet.vn" }, { hostname: "ns4.inet.vn" }] } },
            "PUT",
            `${BASE}/reseller/domains/123456/nameservers`,
        ],
        [
            "reseller records: PATCH /reseller/domains/{id}/records { recordList }",
            INET_OPS.resellerRecordUpdate,
            { path: { id: "123456" }, body: { recordList: [{ action: "add", type: "A", name: "@", data: "192.168.1.1" }] } },
            "PATCH",
            `${BASE}/reseller/domains/123456/records`,
        ],
        [
            "reseller transfer in: POST /reseller/domain-transfers { name, authCode, customerId }",
            INET_OPS.resellerTransferIn,
            { body: { name: "example.vn", authCode: "code", customerId: 1 } },
            "POST",
            `${BASE}/reseller/domain-transfers`,
        ],
        [
            "portal nameservers: PATCH /domain/{domainId}/nameserver { nsList }",
            INET_OPS.portalNameserverUpdate,
            { path: { domainId: "123456" }, body: { nsList: [{ hostname: "ns1.inet.vn" }, { hostname: "ns2.inet.vn" }] } },
            "PATCH",
            `${BASE}/domain/123456/nameserver`,
        ],
        [
            "portal records: PATCH /domain/{domainId}/record { recordList }",
            INET_OPS.portalRecordUpdate,
            {
                path: { domainId: "123456" },
                body: { recordList: [{ name: "@", type: "A", data: "1.2.3.4", action: "ACTION_ADD", domainId: 123456 }] },
            },
            "PATCH",
            `${BASE}/domain/123456/record`,
        ],
    ])("%s, the JSON body as given", (_label, operation, call, method, url) => {
        expect(inetRequestOf(options, FAKE_KEY, operation, call)).toEqual({
            method,
            url,
            headers: AUTH,
            body: call.body,
            timeoutMs: 4000,
        })
    })

    it("encodes a path parameter and refuses one that is missing before anything is sent", () => {
        expect(inetRequestOf(options, FAKE_KEY, INET_OPS.portalDomainGet, { path: { domainId: "a/b" } }).url).toBe(
            `${BASE}/domain/a%2Fb`,
        )
        expect(codeOf(() => inetRequestOf(options, FAKE_KEY, INET_OPS.portalDomainGet, {}))).toBe(InetErrorCode.Rejected)
    })

    it("leaves an absent query value out", () => {
        const request = inetRequestOf(options, FAKE_KEY, INET_OPS.portalDomainList, { query: { name: undefined, page: "2" } })
        expect(request.url).toBe(`${BASE}/domain?page=2`)
    })
})

describe("inetDataOf, the wrapper and the statuses (https://developers.inet.vn/docs/getting-started/response-format)", () => {
    it("answers `data` of a success", () => {
        expect(inetDataOf(inetOk(INET_PORTAL_AVAILABLE))).toEqual(INET_PORTAL_AVAILABLE)
    })

    it.each([
        [400, InetErrorCode.Rejected],
        [401, InetErrorCode.AuthFailed],
        [403, InetErrorCode.AuthFailed],
        [404, InetErrorCode.NotServed],
        [409, InetErrorCode.Conflict],
        [429, InetErrorCode.RateLimited],
        [500, InetErrorCode.Failed],
        [502, InetErrorCode.Failed],
        [503, InetErrorCode.Failed],
        [504, InetErrorCode.Failed],
    ])("types the status %i as %s, by the status alone (never the error text)", (status, code) => {
        expect(codeOf(() => inetDataOf(inetRefused(status)))).toBe(code)
    })

    it("hands on the seconds of Retry-After of a 429", () => {
        const params = paramsOf(() =>
            inetDataOf({ status: 429, headers: { "retry-after": "7" }, body: { success: false, error: "slow" } }),
        )

        expect(params).toEqual({ retryAfterSeconds: 7 })
    })

    it("refuses a 200 that says success false, and fails an answer that is no JSON object", () => {
        expect(codeOf(() => inetDataOf({ status: 200, body: { success: false, error: "x" } }))).toBe(InetErrorCode.Rejected)
        expect(codeOf(() => inetDataOf({ status: 200, body: "<html>" }))).toBe(InetErrorCode.Failed)
    })
})

describe("the parsers of the published answers", () => {
    it("reads the Portal domain page", () => {
        expect(portalDomainPageOf(INET_PORTAL_DOMAIN_PAGE)).toEqual({
            content: [{ id: "123456", name: "example.vn", status: "active", expireDate: "01/01/2027", nameservers: null }],
            totalPages: 1,
        })
    })

    it("reads the Portal domain detail with its nameservers", () => {
        expect(portalDomainDetailOf(INET_PORTAL_DOMAIN_DETAIL)).toEqual({
            id: "123456",
            name: "example.vn",
            status: "active",
            expireDate: "01/01/2027",
            nameservers: ["ns1.inet.vn", "ns2.inet.vn"],
        })
    })

    it("reads availability from the published enum, and fails a value outside it", () => {
        expect(portalAvailabilityOf(INET_PORTAL_AVAILABLE, "mywebsite.vn")).toEqual({ name: "mywebsite.vn", available: true })
        expect(portalAvailabilityOf({ ...INET_PORTAL_AVAILABLE, available: "unavailable" }, "x.vn").available).toBe(false)
        expect(codeOf(() => portalAvailabilityOf({ available: "maybe" }, "x.vn"))).toBe(InetErrorCode.Failed)
    })

    it("reads the Portal records", () => {
        expect(portalRecordsOf(INET_PORTAL_RECORDS)).toEqual([
            { id: "9001", name: "@", type: "A", data: "1.2.3.4", ttl: 300, priority: null },
            { id: "9002", name: "www", type: "CNAME", data: "example.vn", ttl: 300, priority: null },
        ])
    })

    it("reads the reseller list by id and name alone, and fails a row without them", () => {
        expect(resellerDomainRefsOf(INET_RESELLER_DOMAIN_PAGE)).toEqual([{ id: "123456", name: "example.vn" }])
        expect(codeOf(() => resellerDomainRefsOf({ content: [{ name: "example.vn" }] }))).toBe(InetErrorCode.Failed)
    })
})

describe("InetClient", () => {
    it("sends the built request and answers its data", async () => {
        const http = mock<HttpClient>()
        http.request.mockResolvedValue(inetOk(INET_PORTAL_AVAILABLE))
        const client = new InetClient(http, options)

        await expect(client.call(FAKE_KEY, INET_OPS.portalAvailability, { query: { name: "mywebsite.vn" } })).resolves.toEqual(
            INET_PORTAL_AVAILABLE,
        )
        expect(http.request).toHaveBeenCalledWith({
            method: "GET",
            url: `${BASE}/domain/check-available?name=mywebsite.vn`,
            headers: AUTH,
            timeoutMs: 4000,
        })
    })

    it("types a network failure as Unreachable", async () => {
        const http = mock<HttpClient>()
        http.request.mockRejectedValue(new Error("socket hang up"))
        const client = new InetClient(http, options)

        await expect(client.call(FAKE_KEY, INET_OPS.portalDomainList, {})).rejects.toMatchObject({ code: InetErrorCode.Unreachable })
    })

    it("names every operation by the law nivo.api.inet.<method>-<path> once", () => {
        const names = Object.values(INET_OPS).map((operation) => operation.api)
        expect(new Set(names).size).toBe(names.length)
        expect(names.filter((name) => !/^nivo\.api\.inet\.[a-z][a-z0-9-]*$/u.test(name))).toEqual([])
    })
})
