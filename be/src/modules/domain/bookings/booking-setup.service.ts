import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { BookingExceptionsService } from "@modules/domain/booking-exceptions"
import { BookingHoursService } from "@modules/domain/booking-hours"
import { BookingResourcesService } from "@modules/domain/booking-resources"
import { BookingServicesService } from "@modules/domain/booking-services"
import { BookingSettingsService } from "@modules/domain/booking-settings"
import { BookingWaitlistService } from "@modules/domain/booking-waitlist"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    BookingHoursWindow,
    BookingSettingsSaved,
    BookingSetupRef,
    BookingSetupSaved,
    SaveBookingExceptionParams,
    SaveBookingHoursParams,
    SaveBookingPolicyParams,
    SaveBookingPublicPageParams,
    SaveBookingResourceParams,
    SaveBookingServiceParams,
} from "./booking-setup.contracts"
import { BookingsError, BookingsErrorCode } from "./errors/bookings.error"

/** The catalogue capabilities share the removal protocol while each owns its persistence. */
type BookingCatalog = BookingServicesService | BookingResourcesService

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu
const DATE = /^\d{4}-\d{2}-\d{2}$/u
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/u
const SLUG = /^[a-z0-9][a-z0-9-]{2,40}$/u
const HOURS_LIMIT = 56
const MAX_PRICE_VND = 1_000_000_000
const UNIQUE_VIOLATION = "23505"

const ensure = (valid: boolean): void => {
    if (!valid) throw new BookingsError({ code: BookingsErrorCode.InvalidInput })
}

const whole = (value: number, min: number, max: number): boolean =>
    Number.isInteger(value) && value >= min && value <= max

const text = (value: string, max: number, required = false): string => {
    const trimmed = value.trim()
    ensure(value.length <= max && (!required || trimmed !== ""))
    return trimmed
}

const timeWindow = (start: string, end: string): boolean => CLOCK.test(start) && CLOCK.test(end) && end > start

const dateValid = (date: string): boolean => {
    if (!DATE.test(date)) return false
    const parsed = new Date(`${date}T00:00:00Z`)
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
}

const timezoneValid = (timezone: string): boolean => {
    if (timezone.length > 100 || timezone.trim() === "") return false
    try {
        new Intl.DateTimeFormat("en", { timeZone: timezone }).format(0)
        return true
    } catch (cause) {
        throw new BookingsError({ code: BookingsErrorCode.InvalidInput, cause })
    }
}

const hoursValid = (rows: ReadonlyArray<BookingHoursWindow>): boolean => {
    if (rows.length > HOURS_LIMIT) return false
    const sorted = [...rows].sort(
        (left, right) => left.weekday - right.weekday || left.start.localeCompare(right.start),
    )
    return sorted.every((row, index) => {
        const previous = sorted[index - 1]
        return (
            whole(row.weekday, 1, 7) &&
            timeWindow(row.start, row.end) &&
            (previous?.weekday !== row.weekday || previous.end <= row.start)
        )
    })
}

const trimSlug = (value: string): string => {
    let start = 0
    let end = value.length
    while (start < end && value[start] === "-") start += 1
    while (end > start && value[end - 1] === "-") end -= 1
    return value.slice(start, end)
}

const isUniqueViolation = (cause: unknown): boolean => {
    if (typeof cause !== "object" || cause === null) return false
    if ("code" in cause && cause.code === UNIQUE_VIOLATION) return true
    return "driverError" in cause && isUniqueViolation(cause.driverError)
}

@Injectable()
/** Manager-authorized booking setup writes; linked rows are proven inside their owning workspace. */
export class BookingSetupService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly members: WorkspaceMembersService,
        private readonly services: BookingServicesService,
        private readonly resources: BookingResourcesService,
        private readonly hours: BookingHoursService,
        private readonly exceptions: BookingExceptionsService,
        private readonly settings: BookingSettingsService,
        private readonly waitlist: BookingWaitlistService,
    ) {}

    /** Creates or changes a service while preserving its existing catalog identity. */
    async saveService(userId: string, params: SaveBookingServiceParams): Promise<BookingSetupSaved> {
        await this.authorize(userId, params.workspaceId, [params.id])
        const name = text(params.name, 160, true)
        const description = text(params.description, 600)
        const resourceKind = text(params.resourceKind, 40) || null
        ensure(whole(params.durationMin, 5, 1440) && whole(params.bufferMin, 0, 480))
        ensure(params.priceVnd === null || whole(params.priceVnd, 0, MAX_PRICE_VND))
        ensure(params.followupDays === null || whole(params.followupDays, 1, 730))
        ensure(typeof params.active === "boolean")
        const rows = await this.services.save({ ...params, name, description, resourceKind })
        return this.saved(rows, params.id === null)
    }

    /** Creates a resource with its initial hours atomically, or changes an owned resource. */
    async saveResource(userId: string, params: SaveBookingResourceParams): Promise<BookingSetupSaved> {
        await this.authorize(userId, params.workspaceId, [params.id, params.staffId])
        const name = text(params.name, 120, true)
        const kind = text(params.kind, 40) || "staff"
        ensure(whole(params.capacity, 1, 200) && typeof params.active === "boolean")
        return this.entityManager.transaction(async (manager) => {
            if (params.staffId !== null)
                this.saved(await this.resources.lockStaff(params.workspaceId, params.staffId))
            const saved = this.saved(await this.resources.save({ ...params, name, kind }, manager), params.id === null)
            if (params.id === null) await this.hours.defaults(params.workspaceId, saved.id, manager)
            return saved
        })
    }

    /** Removes an unused service; a service with booking or waitlist history is retired. */
    removeService(userId: string, ref: BookingSetupRef): Promise<BookingSetupSaved> {
        return this.removeCatalog(userId, ref, this.services)
    }

    /** Removes an unused resource; a resource with booking or waitlist history is retired. */
    removeResource(userId: string, ref: BookingSetupRef): Promise<BookingSetupSaved> {
        return this.removeCatalog(userId, ref, this.resources)
    }

    /** Replaces one resource's non-overlapping weekly opening windows in a transaction. */
    async saveHours(userId: string, params: SaveBookingHoursParams): Promise<BookingSetupSaved> {
        await this.authorize(userId, params.workspaceId, [params.resourceId])
        ensure(hoursValid(params.rows))
        return this.entityManager.transaction(async (manager) => {
            this.saved(await this.resources.lock(params.workspaceId, params.resourceId, manager))
            await this.hours.replace(params.workspaceId, params.resourceId, params.rows, manager)
            return { id: params.resourceId }
        })
    }

    /** Adds a closing or special opening after proving the optional resource belongs to the workspace. */
    async saveException(userId: string, params: SaveBookingExceptionParams): Promise<BookingSetupSaved> {
        await this.authorize(userId, params.workspaceId, [params.resourceId])
        ensure(dateValid(params.date) && typeof params.closed === "boolean")
        ensure(params.closed || timeWindow(params.start, params.end))
        const note = text(params.note, 200)
        return this.entityManager.transaction(async (manager) => {
            if (params.resourceId !== null)
                this.saved(await this.resources.lock(params.workspaceId, params.resourceId, manager))
            return this.saved(
                await this.exceptions.create(
                    {
                        ...params,
                        start: params.closed ? null : params.start,
                        end: params.closed ? null : params.end,
                        note,
                    },
                    manager,
                ),
                true,
            )
        })
    }

    /** Removes an exception only from the caller's workspace. */
    async removeException(userId: string, ref: BookingSetupRef): Promise<BookingSetupSaved> {
        await this.authorize(userId, ref.workspaceId, [ref.id])
        return this.saved(await this.exceptions.remove(ref.workspaceId, ref.id))
    }

    /** Cancels a waitlist entry while keeping its customer and booking history. */
    async removeWaitlistEntry(userId: string, ref: BookingSetupRef): Promise<BookingSetupSaved> {
        await this.authorize(userId, ref.workspaceId, [ref.id])
        return this.saved(await this.waitlist.cancel(ref.workspaceId, ref.id))
    }

    /** Saves policy while keeping the public slug and publication state unchanged. */
    async savePolicy(userId: string, params: SaveBookingPolicyParams): Promise<BookingSettingsSaved> {
        await this.authorize(userId, params.workspaceId)
        ensure(whole(params.cancelWindowHours, 0, 720) && whole(params.depositPct, 0, 100))
        ensure(whole(params.lateCancelFeePct, 0, 100) && whole(params.noShowFeeVnd, 0, MAX_PRICE_VND))
        ensure(
            whole(params.minLeadMin, 0, 100_000) &&
                whole(params.maxAdvanceDays, 1, 365) &&
                whole(params.slotStepMin, 5, 240),
        )
        ensure(
            typeof params.autoConfirm === "boolean" &&
                typeof params.handoffOrder === "boolean" &&
                timezoneValid(params.timezone),
        )
        const address = text(params.address, 300)
        this.saved(
            await this.settings.savePolicy({ ...params, address, updatedAt: this.clock.now().toISOString() }),
            true,
        )
        return { workspaceId: params.workspaceId }
    }

    /** Saves the public page with a checked slug; the database unique constraint resolves concurrent claims. */
    async savePublicPage(userId: string, params: SaveBookingPublicPageParams): Promise<BookingSettingsSaved> {
        await this.authorize(userId, params.workspaceId)
        const slug = trimSlug(
            text(params.slug, 100)
                .toLowerCase()
                .replace(/[^a-z0-9-]+/gu, "-"),
        )
        ensure(typeof params.enabled === "boolean" && (slug === "" ? !params.enabled : SLUG.test(slug)))
        const note = text(params.note, 400)
        const [owner] = await this.settings.slugOwner(params.workspaceId, slug || null)
        if (owner !== undefined) throw new BookingsError({ code: BookingsErrorCode.SlugTaken })
        try {
            this.saved(
                await this.settings.savePublicPage({
                    workspaceId: params.workspaceId,
                    enabled: params.enabled,
                    slug: slug || null,
                    note,
                    updatedAt: this.clock.now().toISOString(),
                }),
                true,
            )
        } catch (cause) {
            if (isUniqueViolation(cause)) throw new BookingsError({ code: BookingsErrorCode.SlugTaken, cause })
            throw cause
        }
        return { workspaceId: params.workspaceId }
    }

    private async removeCatalog(
        userId: string,
        ref: BookingSetupRef,
        catalog: BookingCatalog,
    ): Promise<BookingSetupSaved> {
        await this.authorize(userId, ref.workspaceId, [ref.id])
        return this.entityManager.transaction(async (manager) => {
            this.saved(await catalog.lock(ref.workspaceId, ref.id, manager))
            const used = await catalog.used(ref.workspaceId, ref.id, manager)
            return this.saved(await catalog.remove(ref.workspaceId, ref.id, used, manager))
        })
    }

    private async authorize(
        userId: string,
        workspaceId: string,
        ids: ReadonlyArray<string | null> = [],
    ): Promise<void> {
        ensure(UUID.test(workspaceId) && ids.every((id) => id === null || UUID.test(id)))
        await this.members.require(userId, workspaceId, ["owner", "manager"])
    }

    private saved(rows: ReadonlyArray<BookingSetupSaved>, creating = false): BookingSetupSaved {
        const [row] = rows
        if (row === undefined)
            throw new BookingsError({
                code: creating ? BookingsErrorCode.NotCreated : BookingsErrorCode.CatalogNotFound,
            })
        return row
    }
}
