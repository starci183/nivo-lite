import { mock } from "@starci/jest-preset"
import { ProviderOfferService, type ProviderOffer } from "@modules/domain/provider-offer"
import type { Logger } from "@modules/platform/logging"
import { GetProviderOfferHandler } from "./get-provider-offer.handler"
import { GetProviderOfferQuery } from "./get-provider-offer.query"

const OFFER: ProviderOffer = { connectionId: "c-1", provider: "zalo_oa", api: [], mcp: [], triggers: [] }

describe("GetProviderOfferHandler", () => {
    it("asks the capability as the signed-in person in the request's workspace, for the named account", async () => {
        const offers = mock<ProviderOfferService>()
        offers.offerOf.mockResolvedValue(OFFER)
        const handler = new GetProviderOfferHandler(mock<Logger>(), offers)

        const offer = await handler.execute(
            new GetProviderOfferQuery({
                request: { workspaceId: "ws-1", connectionId: "c-1" },
                principal: { id: "user-1", role: "authenticated" },
            }),
        )

        expect(offers.offerOf).toHaveBeenCalledWith({ principalId: "user-1", workspaceId: "ws-1" }, "c-1")
        expect(offer).toBe(OFFER)
    })

    it("lets the capability's refusal through unchanged", async () => {
        const offers = mock<ProviderOfferService>()
        const refusal = { code: "PROVIDER_OFFER_CONNECTION_NOT_FOUND" }
        offers.offerOf.mockRejectedValue(refusal)
        const handler = new GetProviderOfferHandler(mock<Logger>(), offers)

        await expect(
            handler.execute(
                new GetProviderOfferQuery({
                    request: { workspaceId: "ws-1", connectionId: "c-2" },
                    principal: { id: "user-1", role: "authenticated" },
                }),
            ),
        ).rejects.toMatchObject({ code: "PROVIDER_OFFER_CONNECTION_NOT_FOUND" })
    })
})
