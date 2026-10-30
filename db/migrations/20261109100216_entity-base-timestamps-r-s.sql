-- entity-base-timestamps-r-s: forward-only; immutable once on origin/main.
-- Entity-base round (BE-PERSISTENCE-3), responsibilities through staff (r to s): every table the entities now map through AbstractEntity / UuidAbstractEntity
-- carries created_at and updated_at as timestamptz NOT NULL DEFAULT now(), and a BEFORE UPDATE trigger (public.set_updated_at, created by
-- 20261109100202_entity-base-set-updated-at) stamps updated_at, so the application never writes it.

ALTER TABLE public.responsibilities ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER responsibilities_set_updated_at BEFORE UPDATE ON public.responsibilities FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.sepay_transactions ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.sepay_transactions ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER sepay_transactions_set_updated_at BEFORE UPDATE ON public.sepay_transactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.shifts_attendance ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.shifts_attendance ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER shifts_attendance_set_updated_at BEFORE UPDATE ON public.shifts_attendance FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.shifts_availability ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER shifts_availability_set_updated_at BEFORE UPDATE ON public.shifts_availability FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.shifts_coverage ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER shifts_coverage_set_updated_at BEFORE UPDATE ON public.shifts_coverage FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.shifts_leave_requests ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER shifts_leave_requests_set_updated_at BEFORE UPDATE ON public.shifts_leave_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.shifts_notifications ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER shifts_notifications_set_updated_at BEFORE UPDATE ON public.shifts_notifications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.shifts_positions ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER shifts_positions_set_updated_at BEFORE UPDATE ON public.shifts_positions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.shifts_schedules ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER shifts_schedules_set_updated_at BEFORE UPDATE ON public.shifts_schedules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.shifts_settings ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER shifts_settings_set_updated_at BEFORE UPDATE ON public.shifts_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.shifts_shifts ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER shifts_shifts_set_updated_at BEFORE UPDATE ON public.shifts_shifts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.shifts_staff_pay ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER shifts_staff_pay_set_updated_at BEFORE UPDATE ON public.shifts_staff_pay FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.shifts_staff ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER shifts_staff_set_updated_at BEFORE UPDATE ON public.shifts_staff FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.shifts_swap_requests ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER shifts_swap_requests_set_updated_at BEFORE UPDATE ON public.shifts_swap_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.staff ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER staff_set_updated_at BEFORE UPDATE ON public.staff FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

