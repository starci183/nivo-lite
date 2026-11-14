import { mock } from "@starci/jest-preset"
import type { HttpClient } from "@modules/platform/http"
import {
    FAKE_KEY,
    TINO_DOMAIN_BY_NAME,
    TINO_DOMAIN_DETAIL,
    TINO_DOMAIN_LIST,
    TINO_LOOKUP,
    TINO_NS_SAVED,
    TINO_RENEW,
    TINO_ROUTE_REFUSED,
    tinoGatewayRefused,
    tinoOk,
} from "@tests/fixtures/builders/domain-registrars.builder"
import { TinoErrorCode } from "./errors/tino.error"
import {
    TinoClient,
    tinoBodyOf,
    tinoDomainDetailOf,
    tinoDomainsOf,
    tinoLookupOf,
    tinoRenewalOf,
    tinoRequestOf,
} from "./tino.client"
import { TINO_OPS } from "./tino.operations"
import type { TinoOptions } from "./tino.options"
import { causeFactsOf } from "@tests/fixtures/builders/cause-facts.builder"

const options: TinoOptions = { apiBase: "https://api.tino.vn", timeoutMs: 4000 }
const BASE = options.apiBase
const AUTH = { Authorization: `Bearer ${FAKE_KEY}` }

const failureOf = (work: () => unknown): ReturnType<typeof causeFactsOf> => {
    try {
        work()
    } catch (cause) {
        return causeFactsOf(cause)
    }
    return {}
}

describe("tinoRequestOf, the request of each route (https://docs.tino.vn/openapi.json)", () => {
    it.each([
        ["get_domain: GET /v1/domain?page&perpage", TINO_OPS.domainList, { query: { page: "0", perpage: "20" } }, `${BASE}/v1/domain?page=0&perpage=20`],
        ["get_domain_name_name: GET /v1/domain/name/{name}", TINO_OPS.domainByName, { path: { name: "example.com" } }, `${BASE}/v1/domain/name/example.com`],
        ["get_domain_id: GET /v1/domain/{id}", TINO_OPS.domainGet, { path: { id: "200001" } }, `${BASE}/v1/domain/200001`],
        ["get_domain_id_dns: GET /v1/domain/{id}/dns", TINO_OPS.dnsList, { path: { id: "200001" } }, `${BASE}/v1/domain/200001/dns`],
    ])("%s, the token in Authorization: Bearer", (_label, operation, call, url) => {
        expect(tinoRequestOf(options, FAKE_KEY, operation, call)).toEqual({ method: "GET", url, headers: AUTH, timeoutMs: 4000 })
    })

    it("delete_domain_id_dns_index: DELETE /v1/domain/{id}/dns/{index} with record_id in the query", () => {
        const call = { path: { id: "200001", index: "3" }, query: { record_id: "3" } }
        expect(tinoRequestOf(options, FAKE_KEY, TINO_OPS.dnsDelete, call)).toEqual({
            method: "DELETE",
            url: `${BASE}/v1/domain/200001/dns/3?record_id=3`,
            headers: AUTH,
            timeoutMs: 4000,
        })
    })

    it.each([
        ["post_domain_lookup", TINO_OPS.domainLookup, {}, { name: "example.com" }, "POST", `${BASE}/v1/domain/lookup`],
        [
            "post_domain_order",
            TINO_OPS.domainOrder,
            {},
            { name: "example.com", years: "1", action: "register", tld_id: "346" },
            "POST",
            `${BASE}/v1/domain/order`,
        ],
        ["post_domain_id_renew", TINO_OPS.domainRenew, { id: "200001" }, { years: "1" }, "POST", `${BASE}/v1/domain/200001/renew`],
        [
            "put_domain_id_ns",
            TINO_OPS.nameserverUpdate,
            { id: "200001" },
            { nameservers: ["ns1.tino.vn", "ns2.tino.vn"] },
            "PUT",
            `${BASE}/v1/domain/200001/ns`,
        ],
        [
            "post_domain_id_dns",
            TINO_OPS.dnsCreate,
            { id: "200001" },
            { name: "www", type: "A", content: "1.2.3.4" },
            "POST",
            `${BASE}/v1/domain/200001/dns`,
        ],
        [
            "put_domain_id_dns_index",
            TINO_OPS.dnsUpdate,
            { id: "200001", index: "3" },
            { record_id: 3, name: "www", type: "A", content: "1.2.3.5" },
            "PUT",
            `${BASE}/v1/domain/200001/dns/3`,
        ],
    ])("%s carries its JSON body", (_label, operation, path, body, method, url) => {
        expect(tinoRequestOf(options, FAKE_KEY, operation, { path, body })).toEqual({
            method,
            url,
            headers: AUTH,
            body,
            timeoutMs: 4000,
        })
    })
})

describe("tinoBodyOf, the gateway's and the routes' refusals (https://docs.tino.vn/docs/api, L\u1ED7i)", () => {
    it("answers the body of a success", () => {
        expect(tinoBodyOf(tinoOk(TINO_NS_SAVED))).toEqual(TINO_NS_SAVED)
    })

    it.each([
        [401, "invalid_token"],
        [403, "insufficient_scope"],
        [403, "ip_not_allowed"],
        [403, "ipnotallowed"],
    ] as const)("types the gateway's %i %s as AuthFailed, its code handed on", (status, code) => {
        expect(failureOf(() => tinoBodyOf(tinoGatewayRefused(status, code)))).toMatchObject({
            code: TinoErrorCode.AuthFailed,
            params: { reason: code },
        })
    })

    it("types a route's business refusal (HTTP 200 with an error array) as Rejected, its code handed on", () => {
        expect(failureOf(() => tinoBodyOf(TINO_ROUTE_REFUSED))).toMatchObject({
            code: TinoErrorCode.Rejected,
            params: { reason: "route_refusal_code" },
        })
    })

    it("types a 5xx and an answer that is no JSON object as Failed (the effect is not known)", () => {
        expect(failureOf(() => tinoBodyOf({ status: 502, body: {} })).code).toBe(TinoErrorCode.Failed)
        expect(failureOf(() => tinoBodyOf({ status: 200, body: "<html>" })).code).toBe(TinoErrorCode.Failed)
    })
})

describe("the parsers of the published example answers", () => {
    it("reads the by-name domains", () => {
        expect(tinoDomainsOf(TINO_DOMAIN_BY_NAME)).toEqual([
            {
                id: "200001",
                name: "example.com",
                status: "Active",
                expires: "2026-12-07",
                nameservers: ["ns1.tino.vn", "ns2.tino.vn"],
                autoRenew: true,
            },
        ])
    })

    it("reads the list without nameservers", () => {
        expect(tinoDomainsOf(TINO_DOMAIN_LIST)[0]).toMatchObject({ id: "200001", nameservers: null, autoRenew: true })
    })

    it("reads the detail and never its contacts", () => {
        const detail = tinoDomainDetailOf(TINO_DOMAIN_DETAIL)
        expect(detail).toEqual({
            id: "200001",
            name: "example.com",
            status: "Active",
            expires: "2026-12-07",
            nameservers: ["ns1.tino.vn", "ns2.tino.vn"],
            autoRenew: true,
        })
        expect(JSON.stringify(detail)).not.toContain("Nguyen")
    })

    it("reads the lookup: `avaliable` as spelled, the tld id, the periods (a cut row is no period)", () => {
        expect(tinoLookupOf(TINO_LOOKUP, "example.com")).toEqual({
            name: "example.com",
            available: true,
            tldId: "346",
            periods: [
                { years: 1, register: 319000, renew: 399000, transfer: 399000 },
                { years: 2, register: 638000, renew: 798000, transfer: 798000 },
            ],
        })
        expect(failureOf(() => tinoLookupOf({ name: "x.com" }, "x.com")).code).toBe(TinoErrorCode.Failed)
    })

    it("reads the renewal's invoice and total", () => {
        expect(tinoRenewalOf(TINO_RENEW)).toEqual({ reference: "1201939", total: 588109 })
    })
})

describe("TinoClient", () => {
    it("sends the built request and answers the body; a network failure is Unreachable", async () => {
        const http = mock<HttpClient>()
        http.request.mockResolvedValueOnce(tinoOk(TINO_LOOKUP)).mockRejectedValueOnce(new Error("timeout"))
        const client = new TinoClient(http, options)

        await expect(client.call(FAKE_KEY, TINO_OPS.domainLookup, { body: { name: "example.com" } })).resolves.toEqual(TINO_LOOKUP)
        await expect(client.call(FAKE_KEY, TINO_OPS.domainList, {})).rejects.toMatchObject({ code: TinoErrorCode.Unreachable })
    })

    it("names every operation by Tino's own id in kebab case, once", () => {
        const names = Object.values(TINO_OPS).map((operation) => operation.api)
        expect(new Set(names).size).toBe(names.length)
        expect(names.filter((name) => !/^nivo\.api\.tino\.(get|post|put|delete)(-[a-z0-9]+)+$/u.test(name))).toEqual([])
    })
})
