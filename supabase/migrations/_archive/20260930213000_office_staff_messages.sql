-- Office: staff members write in the team chat ("Nhắn với tư cách"). Additive only.
-- Staff have no logins in the prototype: the owner writes on their behalf; the message keeps which staff member it was.
alter table public.messages add column if not exists staff_id uuid references public.staff (id) on delete set null;
