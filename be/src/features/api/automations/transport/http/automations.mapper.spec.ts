import { toEmitEventRequest, toPatchRequest } from "./automations.mapper"

describe("automations mapper", () => {
    it("maps the name, data and dedupe key of the event", () => {
        expect(
            toEmitEventRequest({
                event: "payment.received",
                data: { invoiceId: "invoice-1", amountVnd: 250000 },
                dedupe: "payment-1",
            }),
        ).toEqual({
            event: "payment.received",
            data: { invoiceId: "invoice-1", amountVnd: 250000 },
            dedupe: "payment-1",
        })
    })

    it("maps every pipeline setting", () => {
        expect(
            toPatchRequest({
                enabled: true,
                dismissed: true,
                values: { days: 3 },
                body: "Thank you, {customer}",
                autoSend: true,
                googleConnectionId: "google-1",
            }),
        ).toEqual({
            enabled: true,
            dismissed: true,
            values: { days: 3 },
            body: "Thank you, {customer}",
            autoSend: true,
            googleConnectionId: "google-1",
        })
    })

    it("preserves false settings and empty wording", () => {
        expect(
            toPatchRequest({ enabled: false, dismissed: false, values: {}, body: "", autoSend: false }),
        ).toEqual({
            enabled: false,
            dismissed: false,
            values: {},
            body: "",
            autoSend: false,
            googleConnectionId: undefined,
        })
    })

    it("leaves omitted optional settings undefined", () => {
        expect(toPatchRequest({})).toEqual({
            enabled: undefined,
            dismissed: undefined,
            values: undefined,
            body: undefined,
            autoSend: undefined,
            googleConnectionId: undefined,
        })
    })
})
