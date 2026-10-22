-- v0.3.2 step 2: the authority rule says how much, who approves, how and by when.
-- `unit` is what the amount of the action is counted in (VND, a percentage, a count). `auto_max` and `ask_max` are the bands:
-- up to auto_max the action runs alone, above auto_max up to ask_max a person is asked, above ask_max it never runs
-- (a missing bound means no such band). A rule with neither bound keeps the old behaviour: `mode` and `limit_vnd`
-- (run alone strictly below the limit). The approver group is the union of roles, department rooms and explicit members;
-- the default group is the old one (owner and manager). `agents` lists the agents the rule applies to; empty means all.

ALTER TABLE public.authority_rules
    ADD COLUMN unit text DEFAULT 'vnd'::text NOT NULL,
    ADD COLUMN auto_max numeric,
    ADD COLUMN ask_max numeric,
    ADD COLUMN approver_roles text[] DEFAULT ARRAY['owner'::text, 'manager'::text] NOT NULL,
    ADD COLUMN approver_rooms text[] DEFAULT '{}'::text[] NOT NULL,
    ADD COLUMN approver_members uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    ADD COLUMN approval_policy text DEFAULT 'any'::text NOT NULL,
    ADD COLUMN timeout_minutes integer DEFAULT 30 NOT NULL,
    ADD COLUMN agents uuid[] DEFAULT '{}'::uuid[] NOT NULL;

ALTER TABLE public.authority_rules
    ADD CONSTRAINT authority_rules_unit_check CHECK ((unit = ANY (ARRAY['vnd'::text, 'percent'::text, 'count'::text]))),
    ADD CONSTRAINT authority_rules_auto_max_check CHECK (((auto_max IS NULL) OR (auto_max >= (0)::numeric))),
    ADD CONSTRAINT authority_rules_ask_max_check CHECK (((ask_max IS NULL) OR (ask_max >= (0)::numeric))),
    ADD CONSTRAINT authority_rules_bands_order_check CHECK (((auto_max IS NULL) OR (ask_max IS NULL) OR (auto_max <= ask_max))),
    ADD CONSTRAINT authority_rules_percent_check CHECK (((unit <> 'percent'::text) OR ((COALESCE(auto_max, (0)::numeric) <= (100)::numeric) AND (COALESCE(ask_max, (0)::numeric) <= (100)::numeric)))),
    ADD CONSTRAINT authority_rules_approver_roles_check CHECK ((approver_roles <@ ARRAY['owner'::text, 'manager'::text, 'staff'::text])),
    ADD CONSTRAINT authority_rules_approval_policy_check CHECK ((approval_policy = ANY (ARRAY['any'::text, 'all'::text, 'sequential'::text]))),
    ADD CONSTRAINT authority_rules_timeout_check CHECK (((timeout_minutes >= 1) AND (timeout_minutes <= 10080)));
