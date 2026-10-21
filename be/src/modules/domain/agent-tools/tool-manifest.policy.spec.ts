import { Test } from "@nestjs/testing"
import {
    isBookingTool as realIsBookingTool,
    isGatewayTool as realIsGatewayTool,
    isToolName as realIsToolName,
    TOOL_MANIFEST,
} from "./tool-manifest.policy"

const SUBJECT = Symbol("tool-manifest.policy")
type Subject = {
    isBookingTool: typeof realIsBookingTool
    isGatewayTool: typeof realIsGatewayTool
    isToolName: typeof realIsToolName
}

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    isBookingTool: realIsBookingTool,
                    isGatewayTool: realIsGatewayTool,
                    isToolName: realIsToolName,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("tool manifest policy", () => {
    it("lists the chat tools, the agent hand-off, the connector meta-tools and the booking tools", async () => {
        await build()
        expect(TOOL_MANIFEST.map((tool) => tool.name)).toEqual([
            "knowledge.search",
            "lead.create_or_update",
            "approval.request",
            "handoff.to_person",
            "conversation.handOff",
            "tool.search",
            "tool.describe",
            "tool.call",
            "tool.sequence",
            "booking.find_slots",
            "booking.request",
            "booking.cancel",
        ])
    })

    it("knows a manifest name and refuses any other text", async () => {
        const subject = await build()
        expect(subject.isToolName("handoff.to_person")).toBe(true)
        expect(subject.isToolName("shell.exec")).toBe(false)
    })

    it("recognises the booking tools only", async () => {
        const subject = await build()
        expect(subject.isBookingTool("booking.request")).toBe(true)
        expect(subject.isBookingTool("booking.find_slots")).toBe(true)
        expect(subject.isBookingTool("booking.cancel")).toBe(true)
        expect(subject.isBookingTool("knowledge.search")).toBe(false)
    })
})

describe("tool manifest policy gateway tools", () => {
    it("recognises the connector meta-tools only", async () => {
        const subject = await build()
        expect(subject.isGatewayTool("tool.search")).toBe(true)
        expect(subject.isGatewayTool("tool.describe")).toBe(true)
        expect(subject.isGatewayTool("tool.call")).toBe(true)
        expect(subject.isGatewayTool("tool.sequence")).toBe(true)
        expect(subject.isGatewayTool("conversation.handOff")).toBe(false)
    })
})
