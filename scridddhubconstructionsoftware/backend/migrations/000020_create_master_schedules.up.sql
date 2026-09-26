-- MasterSchedule + MasterScheduleMilestone (Screen 11) — "land to possession." One
-- MasterSchedule per project, auto-creating its 5 fixed milestone rows (land_acquisition ->
-- approvals -> construction_start -> structure_complete -> committed_possession_date), same
-- parent+auto-created-children pattern as CertificationPacket (migration 000009).
--
-- confirmed_at is the "Confirm Schedule" action — distinct from any individual milestone's own
-- status, because RERA Section 18 stakes (SBI MCLR + 2%/month buyer interest on a missed
-- committed possession date) attach to the schedule as a whole being locked in, not to one row.
CREATE TABLE master_schedules (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id   UUID NOT NULL UNIQUE REFERENCES projects(id),
    confirmed_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- target_date is month-precision in the wireframe ("Mar 2026", "est. Jun 2028") — stored as a
-- full date (first of month) and formatted client-side, same as every other date this session.
CREATE TABLE master_schedule_milestones (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    master_schedule_id  UUID NOT NULL REFERENCES master_schedules(id),
    milestone_type       TEXT NOT NULL CHECK (milestone_type IN (
        'land_acquisition', 'approvals', 'construction_start', 'structure_complete',
        'committed_possession_date'
    )),
    status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('complete', 'in_progress', 'pending')),
    target_date         DATE NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (master_schedule_id, milestone_type)
);

CREATE INDEX idx_master_schedule_milestones_schedule_id ON master_schedule_milestones (master_schedule_id);
