"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  RefreshCw,
  Save,
  Trash2,
  ListChecks,
  Plus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type EventRow = {
  id: string;
  category: string;
  name: string;
  discipline: string;
  format: string;
};

type ScheduleRow = {
  id: string;
  event_id: string;
  scheduled_date: string | null;
  start_time: string | null;
  end_time: string | null;
  venue: string | null;
  notes: string | null;
};

type ScheduleForm = {
  event_id: string;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  venue: string;
  notes: string;
};

const SECTIONS = ["Senior Boys", "Senior Girls", "Junior Boys", "Junior Girls"];
const blankForm: ScheduleForm = {
  event_id: "",
  scheduled_date: "",
  start_time: "",
  end_time: "",
  venue: "",
  notes: "",
};

function displayTime(value: string | null) {
  if (!value) return "Time TBA";
  const [hh, mm] = value.slice(0, 5).split(":").map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return value.slice(0, 5);
  const suffix = hh >= 12 ? "PM" : "AM";
  const hour = hh % 12 || 12;
  return `${hour}:${String(mm).padStart(2, "0")} ${suffix}`;
}

export default function AdminSchedulePage() {
  const supabase = useMemo(() => createClient(), []);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [section, setSection] = useState("");
  const [form, setForm] = useState<ScheduleForm>(blankForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [eventResult, scheduleResult] = await Promise.all([
      supabase
        .from("events")
        .select("id,category,name,discipline,format")
        .eq("is_active", true)
        .order("category")
        .order("name"),
      supabase
        .from("event_schedule")
        .select("id,event_id,scheduled_date,start_time,end_time,venue,notes")
        .order("scheduled_date", { ascending: true, nullsFirst: false })
        .order("start_time", { ascending: true, nullsFirst: false }),
    ]);

    if (eventResult.error || scheduleResult.error) {
      setError(eventResult.error?.message || scheduleResult.error?.message || "Unable to load schedule.");
    }
    setEvents((eventResult.data ?? []) as EventRow[]);
    setRows((scheduleResult.data ?? []) as ScheduleRow[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const eventMap = useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);
  const scheduledIds = useMemo(() => new Set(rows.map((row) => row.event_id)), [rows]);
  const editingEventId = editing ? rows.find((row) => row.id === editing)?.event_id ?? null : null;

  // Scheduled events are removed from the picker. The event currently being edited
  // remains selectable so an existing entry can still be modified.
  const availableEvents = useMemo(() => {
    if (!section) return [];
    return events
      .filter((event) => event.category === section)
      .filter((event) => !scheduledIds.has(event.id) || event.id === editingEventId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [events, section, scheduledIds, editingEventId]);

  const unscheduledCount = events.filter((event) => !scheduledIds.has(event.id)).length;
  const filteredRows = rows.filter((row) => {
    const event = eventMap.get(row.event_id);
    if (!event) return false;
    const query = filter.trim().toLowerCase();
    return !query || `${event.name} ${event.category} ${event.discipline} ${row.venue ?? ""} ${row.notes ?? ""}`
      .toLowerCase()
      .includes(query);
  });

  const resetForm = (keepSection = true) => {
    setForm(blankForm);
    setEditing(null);
    if (!keepSection) setSection("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!section) {
      setError("Select a section first.");
      return;
    }
    if (!form.event_id) {
      setError("Select an event from the selected section.");
      return;
    }
    const chosenEvent = eventMap.get(form.event_id);
    if (!chosenEvent || chosenEvent.category !== section) {
      setError("The selected event does not belong to this section. Select it again.");
      return;
    }
    if (!form.scheduled_date) {
      setError("Choose the date for this event.");
      return;
    }
    if (!form.start_time || !form.end_time) {
      setError("Enter both a start time and an end time.");
      return;
    }
    if (form.end_time <= form.start_time) {
      setError("End time must be later than start time.");
      return;
    }
    if (rows.some((row) => row.event_id === form.event_id && row.id !== editing)) {
      setError("This event already has a schedule entry. Edit or remove its existing entry instead.");
      return;
    }

    setSaving(true);
    const payload = {
      event_id: form.event_id,
      scheduled_date: form.scheduled_date,
      start_time: form.start_time,
      end_time: form.end_time,
      venue: form.venue.trim() || null,
      notes: form.notes.trim() || null,
    };

    const result = editing
      ? await supabase.from("event_schedule").update(payload).eq("id", editing)
      : await supabase.from("event_schedule").insert(payload);

    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }

    setMessage(editing ? "Schedule updated successfully." : `${chosenEvent.name} has been scheduled and removed from the available event list.`);
    resetForm(true);
    await load();
  };

  const edit = (row: ScheduleRow) => {
    const event = eventMap.get(row.event_id);
    setEditing(row.id);
    setSection(event?.category ?? "");
    setForm({
      event_id: row.event_id,
      scheduled_date: row.scheduled_date ?? "",
      start_time: row.start_time?.slice(0, 5) ?? "",
      end_time: row.end_time?.slice(0, 5) ?? "",
      venue: row.venue ?? "",
      notes: row.notes ?? "",
    });
    setMessage("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (row: ScheduleRow) => {
    const event = eventMap.get(row.event_id);
    if (!confirm(`Remove the schedule for ${event?.name ?? "this event"}? It will become available in the event picker again.`)) return;
    setMessage("");
    setError("");
    const { error: dbError } = await supabase.from("event_schedule").delete().eq("id", row.id);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    if (editing === row.id) resetForm(true);
    setMessage(`${event?.name ?? "The event"} is unscheduled and available to select again.`);
    await load();
  };

  return (
    <main className="adminSchedulePage scheduleWorkspace">
      <div className="adminPageHeader schedulePageHeader">
        <div>
          <div className="eyebrow">SARGAMIYA 2026 · ADMIN</div>
          <h1>Event Schedule</h1>
          <p>Build the programme section by section. Scheduled events automatically leave the available event list.</p>
        </div>
        <div className="adminHeaderActions">
          <Link href="/schedule">Public Schedule</Link>
          <button type="button" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={15} className={loading ? "scheduleSpin" : ""} /> Refresh
          </button>
        </div>
      </div>

      <div className="scheduleStats" aria-label="Schedule summary">
        <div className="scheduleStatCard"><span>Active events</span><strong>{events.length}</strong><small>Across all four sections</small></div>
        <div className="scheduleStatCard"><span>Scheduled</span><strong>{rows.filter((row) => eventMap.has(row.event_id)).length}</strong><small>Entries in the programme</small></div>
        <div className="scheduleStatCard scheduleStatHighlight"><span>Available to schedule</span><strong>{unscheduledCount}</strong><small>Automatically excludes scheduled events</small></div>
      </div>

      {(message || error) && (
        <div className={error ? "adminError scheduleNotice" : "adminSuccess scheduleNotice"} role={error ? "alert" : "status"}>
          {error ? null : <CheckCircle2 size={17} />}
          <span>{error || message}</span>
        </div>
      )}

      <form className="scheduleForm scheduleBuilder" onSubmit={submit}>
        <div className="formTitle scheduleFormHeading">
          <div className="scheduleFormIcon"><CalendarDays size={20} /></div>
          <div>
            <strong>{editing ? "Edit schedule entry" : "Add to the programme"}</strong>
            <span>{editing ? "Update this entry. Its event stays reserved until you remove the schedule." : "Choose a section, then select from only the events that have not been scheduled yet."}</span>
          </div>
          {editing && <span className="scheduleEditingPill">Editing</span>}
        </div>

        <label className="scheduleField">
          <span>Section <b>*</b></span>
          <select
            value={section}
            required
            onChange={(event) => {
              setSection(event.target.value);
              setForm((current) => ({ ...current, event_id: "" }));
            }}
          >
            <option value="">Select section</option>
            {SECTIONS.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>

        <label className="scheduleField scheduleFieldEvent">
          <span>Event <b>*</b></span>
          <select
            value={form.event_id}
            required
            disabled={!section || availableEvents.length === 0}
            onChange={(event) => setForm((current) => ({ ...current, event_id: event.target.value }))}
          >
            <option value="">
              {!section ? "Select a section first" : availableEvents.length ? "Select an available event" : "No unscheduled events in this section"}
            </option>
            {availableEvents.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
          {section && <small className="scheduleFieldHint">{availableEvents.length} event{availableEvents.length === 1 ? "" : "s"} available in {section}</small>}
        </label>

        <label className="scheduleField">
          <span>Date <b>*</b></span>
          <input type="date" value={form.scheduled_date} required onChange={(event) => setForm((current) => ({ ...current, scheduled_date: event.target.value }))} />
        </label>

        <label className="scheduleField">
          <span>Start time <b>*</b></span>
          <div className="scheduleInputWithIcon"><Clock3 size={16} /><input type="time" value={form.start_time} required onChange={(event) => setForm({ ...form, start_time: event.target.value })} /></div>
        </label>

        <label className="scheduleField">
          <span>End time <b>*</b></span>
          <div className="scheduleInputWithIcon"><Clock3 size={16} /><input type="time" value={form.end_time} required min={form.start_time || undefined} onChange={(event) => setForm({ ...form, end_time: event.target.value })} /></div>
        </label>

        <label className="scheduleField scheduleFieldVenue">
          <span>Venue</span>
          <div className="scheduleInputWithIcon"><MapPin size={16} /><input value={form.venue} onChange={(event) => setForm({ ...form, venue: event.target.value })} placeholder="e.g. Main Hall, Art Room" /></div>
        </label>

        <label className="scheduleField scheduleFieldNotes">
          <span>Notes <small>(optional)</small></span>
          <input value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Reporting instructions, materials, or other details" />
        </label>

        <div className="scheduleFormFooter">
          <p><span>*</span> Required fields. Saving a schedule reserves the event and hides it from the event selector.</p>
          <div className="formActions">
            <button type="submit" disabled={saving || loading}>
              {saving ? <RefreshCw size={16} className="scheduleSpin" /> : editing ? <Save size={16} /> : <Plus size={16} />}
              {saving ? "Saving…" : editing ? "Save changes" : "Add to schedule"}
            </button>
            {editing && <button type="button" className="secondary" onClick={() => resetForm(false)}>Cancel edit</button>}
          </div>
        </div>
      </form>

      <section className="scheduleAdminTable scheduleEntriesPanel">
        <div className="adminSectionHeader scheduleEntriesHeader">
          <div><div className="eyebrow">PUBLISHED PROGRAMME</div><h2>Scheduled Events</h2><p>These events are no longer available in the new-schedule selector.</p></div>
          <div className="scheduleSearch"><ListChecks size={16} /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Search event, section, venue…" aria-label="Search scheduled events" /></div>
        </div>
        {loading ? <div className="adminEmpty">Loading schedule…</div> : filteredRows.length === 0 ? (
          <div className="scheduleEmptyState">
            <div><CalendarDays size={25} /></div>
            <strong>No schedule entries yet</strong>
            <p>Select a section and event above to start building the programme.</p>
          </div>
        ) : (
          <div className="adminTableWrap scheduleTableWrap">
            <table>
              <thead><tr><th>Section / Event</th><th>Date & Time</th><th>Venue & Notes</th><th>Actions</th></tr></thead>
              <tbody>
                {filteredRows.map((row) => {
                  const item = eventMap.get(row.event_id);
                  if (!item) return null;
                  return (
                    <tr key={row.id} className={editing === row.id ? "scheduleEditingRow" : ""}>
                      <td><span className="scheduleSectionTag">{item.category}</span><strong className="scheduleTableEvent">{item.name}</strong><small>{item.discipline} · {item.format === "team" || item.format === "group" ? "Group event" : "Individual event"}</small></td>
                      <td><strong>{row.scheduled_date ? new Date(`${row.scheduled_date}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Date TBA"}</strong><small>{displayTime(row.start_time)}{row.end_time ? ` – ${displayTime(row.end_time)}` : " · End time TBA"}</small></td>
                      <td><strong>{row.venue || "Venue TBA"}</strong>{row.notes && <small>{row.notes}</small>}</td>
                      <td><div className="scheduleRowActions"><button type="button" onClick={() => edit(row)}>Edit</button><button type="button" className="danger" onClick={() => void remove(row)} title="Remove schedule and make event available again"><Trash2 size={14} /> Remove</button></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
