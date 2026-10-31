import { Test } from "@nestjs/testing"
import {
    connectorStatusOf as realConnectorStatusOf,
    isPlannedConnector as realIsPlannedConnector,
} from "./connector-catalog.policy"

const SUBJECT = Symbol("connector-catalog.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { connectorStatusOf: realConnectorStatusOf, isPlannedConnector: realIsPlannedConnector },
            },
        ],
    }).compile()
    const subject = moduleRef.get<{
        connectorStatusOf: typeof realConnectorStatusOf
        isPlannedConnector: typeof realIsPlannedConnector
    }>(SUBJECT)
    return { subject }
}

describe("connector catalog policy", () => {
    it("answers the status of a listed connector", async () => {
        const { subject } = await buildSubject()

        expect(subject.connectorStatusOf("sepay")).toBe("official")
        expect(subject.connectorStatusOf("meta")).toBe("early")
        expect(subject.connectorStatusOf("shopee")).toBe("soon")
        expect(subject.connectorStatusOf("google_drive")).toBe("early")
    })

    it("answers undefined for an id the catalog does not list, whatever its spelling", async () => {
        const { subject } = await buildSubject()

        expect(subject.connectorStatusOf("nope")).toBeUndefined()
        expect(subject.connectorStatusOf("constructor")).toBeUndefined()
    })

    it("accepts only planned connectors as wanted", async () => {
        const { subject } = await buildSubject()

        expect(subject.isPlannedConnector("shopee")).toBe(true)
        expect(subject.isPlannedConnector("sepay")).toBe(false)
        expect(subject.isPlannedConnector("nope")).toBe(false)
    })
})
