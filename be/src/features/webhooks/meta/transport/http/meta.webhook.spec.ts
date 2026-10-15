import { HttpStatus, RequestMethod } from "@nestjs/common"
import type { RawBodyRequest } from "@nestjs/common"
import { HEADERS_METADATA, HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants"
import { Test } from "@nestjs/testing"
import type { Request } from "express"
import { mock } from "@starci/jest-preset"
import { ConnectionsError, ConnectionsErrorCode } from "@modules/domain/connections"
import { MetaConnectionsService } from "@modules/domain/meta-connections"
import { MetaInboxService } from "@modules/domain/meta-inbox"
import { MetaWebhook } from "./meta.webhook"

const RAW = Buffer.from('{\n  "object": "page", "entry": []\n}\n')
const SIGNATURE = "sha256=provider-signature"
const CHALLENGE = " 000123\n<&> "

const build = async () => {
    const inbox = mock<MetaInboxService>()
    inbox.accept.mockResolvedValue(undefined)
    const verifier = mock<MetaConnectionsService>()
    verifier.respondToChallenge.mockResolvedValue(CHALLENGE)
    const moduleRef = await Test.createTestingModule({
        controllers: [MetaWebhook],
        providers: [
            { provide: MetaInboxService, useValue: inbox },
            { provide: MetaConnectionsService, useValue: verifier },
        ],
    }).compile()
    return { door: moduleRef.get(MetaWebhook), inbox, verifier }
}

describe("MetaWebhook", () => {
    it.each([
        { rawBody: RAW, signature: SIGNATURE },
        { rawBody: undefined, signature: undefined },
    ])("passes the exact raw body and signature to the inbox: %j", async ({ rawBody, signature }) => {
        const { door, inbox } = await build()

        const result = await door.receive(mock<RawBodyRequest<Request>>({ rawBody }), signature)

        expect(result).toBeUndefined()
        expect(inbox.accept).toHaveBeenCalledTimes(1)
        expect(inbox.accept).toHaveBeenCalledWith(rawBody, signature)
        expect(inbox.accept.mock.calls[0]?.[0]).toBe(rawBody)
    })

    it("waits for inbox acceptance before acknowledging the delivery", async () => {
        const { door, inbox } = await build()
        let acknowledge: (() => void) | undefined
        inbox.accept.mockReturnValue(
            new Promise<void>((resolve) => {
                acknowledge = resolve
            }),
        )
        let returned = false

        const response = door.receive(mock<RawBodyRequest<Request>>({ rawBody: RAW }), SIGNATURE).then((result) => {
            returned = true
            return result
        })
        await Promise.resolve()

        expect(returned).toBe(false)
        expect(inbox.accept).toHaveBeenCalledTimes(1)
        acknowledge?.()
        await expect(response).resolves.toBeUndefined()
        expect(returned).toBe(true)
    })

    it("lets the inbox signature refusal reach Meta unchanged", async () => {
        const { door, inbox } = await build()
        const failure = new Error("signature invalid")
        inbox.accept.mockRejectedValue(failure)

        await expect(door.receive(mock<RawBodyRequest<Request>>({ rawBody: RAW }), SIGNATURE)).rejects.toBe(failure)

        expect(inbox.accept).toHaveBeenCalledTimes(1)
        expect(inbox.accept).toHaveBeenCalledWith(RAW, SIGNATURE)
    })

    it("returns the verifier's exact challenge text and passes the provider query unchanged", async () => {
        const { door, verifier } = await build()
        const query = {
            "hub.mode": "subscribe",
            "hub.verify_token": "verify-token",
            "hub.challenge": CHALLENGE,
        }

        await expect(door.challenge(query)).resolves.toBe(CHALLENGE)

        expect(verifier.respondToChallenge).toHaveBeenCalledTimes(1)
        expect(verifier.respondToChallenge).toHaveBeenCalledWith(query)
        expect(verifier.respondToChallenge.mock.calls[0]?.[0]).toBe(query)
    })

    it("lets the verifier's wrong-token refusal reach Meta unchanged", async () => {
        const { door, verifier } = await build()
        const query = {
            "hub.mode": "subscribe",
            "hub.verify_token": "wrong-token",
            "hub.challenge": CHALLENGE,
        }
        const failure = new ConnectionsError({ code: ConnectionsErrorCode.Forbidden })
        verifier.respondToChallenge.mockRejectedValue(failure)

        await expect(door.challenge(query)).rejects.toBe(failure)

        expect(verifier.respondToChallenge).toHaveBeenCalledTimes(1)
        expect(verifier.respondToChallenge).toHaveBeenCalledWith(query)
    })

    it("keeps both provider webhook routes and acknowledges accepted POSTs with HTTP 200 and no result", () => {
        expect(Reflect.getMetadata(PATH_METADATA, MetaWebhook)).toBe("api/connections/meta")
        expect(Reflect.getMetadata(PATH_METADATA, MetaWebhook.prototype.receive)).toBe("webhook")
        expect(Reflect.getMetadata(METHOD_METADATA, MetaWebhook.prototype.receive)).toBe(RequestMethod.POST)
        expect(Reflect.getMetadata(HTTP_CODE_METADATA, MetaWebhook.prototype.receive)).toBe(HttpStatus.OK)
        expect(Reflect.getMetadata(PATH_METADATA, MetaWebhook.prototype.challenge)).toBe("webhook")
        expect(Reflect.getMetadata(METHOD_METADATA, MetaWebhook.prototype.challenge)).toBe(RequestMethod.GET)
        expect(Reflect.getMetadata(HEADERS_METADATA, MetaWebhook.prototype.challenge)).toEqual([
            { name: "content-type", value: "text/plain" },
        ])
    })
})
