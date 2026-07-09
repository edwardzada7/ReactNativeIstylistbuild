// Force a stable timezone so date/time-derived assertions (e.g. booking
// scheduled_at -> time) are deterministic regardless of the host machine.
process.env.TZ = 'UTC';
