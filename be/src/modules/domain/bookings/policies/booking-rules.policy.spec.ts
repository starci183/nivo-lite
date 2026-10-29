import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import { DEFAULT_SETTINGS } from "../bookings.contracts"
import type { BookableService, BookingModel, BookingResource } from "../bookings.contracts"
import {
    normaliseBookingPhone,
    isPlausibleBookingPhone,
    clampParty,
    deskReasonOf,
    depositFor,
    fallbackResource,
    idempotencyKeyOf,
    isActiveStatus,
    isLocalDateTime,
    isPlausiblePhone,
    leaveBlocks,
    noShowShare,
    normaliseEmail,
    normalisePhone,
    planInputOf,
    startingBetween,
    summariseRange,
    weightedUtilisation,
} from "./booking-rules.policy"
import type { FigureRow } from "./booking-rules.policy"
const SUBJECT = Symbol("booking-rules.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    normalisePhone,
                    isPlausiblePhone,
                    normaliseBookingPhone,
                    isPlausibleBookingPhone,
                    normaliseEmail,
                    depositFor,
                    summariseRange,
                    noShowShare,
                    weightedUtilisation,
                    startingBetween,
                    fallbackResource,
                    leaveBlocks,
                    deskReasonOf,
                    clampParty,
                    idempotencyKeyOf,
                    isLocalDateTime,
                    planInputOf,
                    isActiveStatus,
                },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./booking-rules.policy")>(SUBJECT)
}

const rowOf = builder<FigureRow>({
    status: "confirmed",
    resourceId: "r1",
    partySize: 1,
    startMs: 0,
    endMs: 60 * 60_000,
    priceVnd: null,
})
const resourceOf = builder<BookingResource>({
    id: "r1",
    name: "Anna",
    kind: "staff",
    capacity: 1,
    active: true,
    sort: 0,
})

describe("booking-rules.policy", () => {
    describe("normalisePhone", () => {
        it("turns a local number into the 84 form", async () => {
            const subject = await build()

            expect(subject.normalisePhone("0912 345 678")).toBe("84912345678")
            expect(subject.normalisePhone("912345678")).toBe("84912345678")
        })

        it("keeps a number that already has the country code", async () => {
            const subject = await build()

            expect(subject.normalisePhone("+84 912 345 678")).toBe("84912345678")
            expect(subject.normalisePhone("84912345678")).toBe("84912345678")
        })

        it("keeps the digits of any other length", async () => {
            const subject = await build()

            expect(subject.normalisePhone("12345678901")).toBe("12345678901")
        })

        it("is null when there are no digits", async () => {
            const subject = await build()

            expect(subject.normalisePhone("abc")).toBeNull()
            expect(subject.normalisePhone("")).toBeNull()
        })
    })

    describe("isPlausiblePhone", () => {
        it("accepts eight to fifteen digits only", async () => {
            const subject = await build()

            expect(subject.isPlausiblePhone(null)).toBe(false)
            expect(subject.isPlausiblePhone("1234567")).toBe(false)
            expect(subject.isPlausiblePhone("1234567890123456")).toBe(false)
            expect(subject.isPlausiblePhone("84912345678")).toBe(true)
        })
    })

    describe("normaliseEmail", () => {
        it("lower-cases and trims an address", async () => {
            const subject = await build()

            expect(subject.normaliseEmail("  Anna@Example.COM ")).toBe("anna@example.com")
        })

        it("refuses text that is not an address", async () => {
            const subject = await build()

            expect(subject.normaliseEmail("anna")).toBeNull()
            expect(subject.normaliseEmail(`a@${"b".repeat(20000)}`)).toBeNull()
            expect(subject.normaliseEmail("a@b..c")).toBe("a@b..c")
            expect(subject.normaliseEmail("a@@b.c")).toBeNull()
            expect(subject.normaliseEmail("a@.c")).toBeNull()
            expect(subject.normaliseEmail("a@b.c.")).toBe("a@b.c.")
            expect(subject.normaliseEmail("")).toBeNull()
        })

        it("cuts an address at 120 characters", async () => {
            const subject = await build()

            expect(subject.normaliseEmail(`${"a".repeat(130)}@example.com`)).toHaveLength(120)
        })
    })
})

describe("booking-rules.policy", () => {
    describe("depositFor", () => {
        it("rounds a share of the price", async () => {
            const subject = await build()

            expect(subject.depositFor(250_000, 30)).toBe(75_000)
            expect(subject.depositFor(99_999, 33)).toBe(33_000)
        })

        it("is zero without a price or without a percentage", async () => {
            const subject = await build()

            expect(subject.depositFor(null, 30)).toBe(0)
            expect(subject.depositFor(0, 30)).toBe(0)
            expect(subject.depositFor(250_000, 0)).toBe(0)
        })
    })
})

describe("booking-rules.policy", () => {
    describe("summariseRange", () => {
        it("counts statuses, books minutes of the booked ones and sums the done revenue", async () => {
            const subject = await build()

            const rows = [
                rowOf({ status: "confirmed", partySize: 2 }),
                rowOf({ status: "done", priceVnd: 100_000 }),
                rowOf({ status: "done", resourceId: "r2" }),
                rowOf({ status: "cancelled" }),
            ]
            const summary = subject.summariseRange(rows)
            expect(summary.byStatus).toEqual({ confirmed: 1, done: 2, cancelled: 1 })
            expect(summary.bookedByResource.get("r1")).toBe(180)
            expect(summary.bookedByResource.get("r2")).toBe(60)
            expect(summary.doneRevenueVnd).toBe(100_000)
        })

        it("is empty for no rows", async () => {
            const subject = await build()

            expect(subject.summariseRange([])).toEqual({ byStatus: {}, bookedByResource: new Map(), doneRevenueVnd: 0 })
        })
    })

    describe("noShowShare", () => {
        it("is the rounded share of no-shows among the finished", async () => {
            const subject = await build()

            expect(subject.noShowShare(2, 1)).toBe(33)
        })

        it("is null when nothing finished", async () => {
            const subject = await build()

            expect(subject.noShowShare(0, 0)).toBeNull()
        })
    })

    describe("weightedUtilisation", () => {
        it("weighs each resource by its open minutes", async () => {
            const subject = await build()

            const list = [
                { resourceId: "a", name: "A", openMin: 100, bookedMin: 100, pct: 100 },
                { resourceId: "b", name: "B", openMin: 300, bookedMin: 0, pct: 0 },
            ]
            expect(subject.weightedUtilisation(list)).toBe(25)
        })

        it("is null when no resource has open hours", async () => {
            const subject = await build()

            expect(
                subject.weightedUtilisation([{ resourceId: "a", name: "A", openMin: 0, bookedMin: 0, pct: 0 }]),
            ).toBeNull()
            expect(subject.weightedUtilisation([])).toBeNull()
        })
    })
})

describe("booking-rules.policy", () => {
    describe("startingBetween", () => {
        it("counts the rows that start inside the range and are not cancelled", async () => {
            const subject = await build()

            const rows = [
                rowOf({ startMs: 5 }),
                rowOf({ startMs: 10 }),
                rowOf({ startMs: 0, status: "cancelled" }),
                rowOf({ startMs: 0 }),
            ]
            expect(subject.startingBetween(rows, 0, 10)).toBe(2)
        })
    })
})

describe("booking-rules.policy", () => {
    describe("leaveBlocks", () => {
        it("blocks a resource from the first leave day until the end of the last", async () => {
            const subject = await build()

            const [block] = subject.leaveBlocks(
                [{ resourceId: "r1", staffId: "p1", fromDate: "2026-10-12", toDate: "2026-10-13" }],
                "Asia/Ho_Chi_Minh",
            )
            expect(block).toEqual({
                id: "leave:p1:2026-10-12",
                resourceId: "r1",
                startMs: Date.UTC(2026, 9, 11, 17, 0),
                blockEndMs: Date.UTC(2026, 9, 13, 17, 0),
                partySize: 1000,
            })
        })

        it("is empty without leave", async () => {
            const subject = await build()

            expect(subject.leaveBlocks([], "Asia/Ho_Chi_Minh")).toEqual([])
        })
    })

    describe("fallbackResource", () => {
        const resources = [
            resourceOf({ active: false }),
            resourceOf({ id: "r2", kind: "room" }),
            resourceOf({ id: "r3", kind: "staff" }),
        ]

        it("takes the first active resource of the kind, or of any kind", async () => {
            const subject = await build()

            expect(subject.fallbackResource(resources, "staff")?.id).toBe("r3")
            expect(subject.fallbackResource(resources, null)?.id).toBe("r2")
        })

        it("is null when none fits", async () => {
            const subject = await build()

            expect(subject.fallbackResource(resources, "bay")).toBeNull()
        })
    })

    describe("deskReasonOf", () => {
        it("keeps the reasons the desk names and calls every other one a bad time", async () => {
            const subject = await build()

            expect(subject.deskReasonOf("closed")).toBe("closed")
            expect(subject.deskReasonOf("full")).toBe("full")
            expect(subject.deskReasonOf("no_resource")).toBe("no_resource")
            expect(subject.deskReasonOf("too_soon")).toBe("datetime_invalid")
            expect(subject.deskReasonOf("too_far")).toBe("datetime_invalid")
            expect(subject.deskReasonOf("no_service")).toBe("datetime_invalid")
        })
    })

    describe("clampParty", () => {
        it("keeps a whole number from one to twenty", async () => {
            const subject = await build()

            expect(subject.clampParty(3.4)).toBe(3)
            expect(subject.clampParty(0)).toBe(1)
            expect(subject.clampParty(-5)).toBe(1)
            expect(subject.clampParty(99)).toBe(20)
            expect(subject.clampParty(Number.NaN)).toBe(1)
        })
    })
})

describe("booking-rules.policy", () => {
    describe("idempotencyKeyOf", () => {
        it("prefixes a usable token and refuses the others", async () => {
            const subject = await build()

            expect(subject.idempotencyKeyOf("abcd-1234")).toBe("public:abcd-1234")
            expect(subject.idempotencyKeyOf("short")).toBeNull()
            expect(subject.idempotencyKeyOf("has space in it")).toBeNull()
            expect(subject.idempotencyKeyOf("")).toBeNull()
        })
    })
})

describe("booking-rules.policy", () => {
    describe("isLocalDateTime", () => {
        it("needs both texts in shape", async () => {
            const subject = await build()

            expect(subject.isLocalDateTime("2026-10-12", "09:30")).toBe(true)
            expect(subject.isLocalDateTime("12/10/2026", "09:30")).toBe(false)
            expect(subject.isLocalDateTime("2026-10-12", "9:30")).toBe(false)
        })
    })

    describe("planInputOf", () => {
        it("joins the model of a workspace with one service for the planner", async () => {
            const subject = await build()

            const model: BookingModel = {
                settings: {
                    ...DEFAULT_SETTINGS,
                    timezone: "Asia/Tokyo",
                    slotStepMin: 20,
                    minLeadMin: 5,
                    maxAdvanceDays: 9,
                },
                services: [],
                resources: [resourceOf()],
                hours: [],
                exceptions: [],
            }
            const service: BookableService = {
                id: "s1",
                name: "Cut",
                description: "",
                durationMin: 45,
                bufferMin: 15,
                priceVnd: null,
                resourceKind: "staff",
                active: true,
            }

            expect(subject.planInputOf(model, service, [], 123, 2)).toEqual({
                service: { id: "s1", durationMin: 45, bufferMin: 15, resourceKind: "staff", active: true },
                resources: model.resources,
                hours: [],
                exceptions: [],
                taken: [],
                policy: { timezone: "Asia/Tokyo", slotStepMin: 20, minLeadMin: 5, maxAdvanceDays: 9 },
                nowMs: 123,
                partySize: 2,
            })
        })
    })

    describe("isActiveStatus", () => {
        it("is true for the statuses that are still ahead and false for the closed ones", async () => {
            const subject = await build()

            expect(["requested", "confirmed", "rescheduled"].every(subject.isActiveStatus)).toBe(true)
            expect(["cancelled", "no_show", "done", "other"].some(subject.isActiveStatus)).toBe(false)
        })
    })
})
