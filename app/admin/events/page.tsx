"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronDown,
  Edit3,
  Layers3,
  Plus,
  RefreshCw,
  Search,
  ToggleLeft,
  ToggleRight,
  Trophy,
  Users,
  X,
  Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/* ============================================================
   TYPES
============================================================ */

type EventFormat = "individual" | "relay" | "team";

type EventCategory =
  | "Junior Boys"
  | "Junior Girls"
  | "Senior Boys"
  | "Senior Girls";

type EventRow = {
  id: string;
  category: EventCategory;
  name: string;
  slug: string;
  discipline: string;
  format: EventFormat;
  is_active: boolean;
  created_at: string;
  scoring_format: EventFormat | null;
};

type EventForm = {
  name: string;
  category: EventCategory;
  discipline: string;
  format: EventFormat;
  scoring_format: EventFormat;
  is_active: boolean;
};

/* ============================================================
   CONSTANTS
============================================================ */

const CATEGORIES: EventCategory[] = [
  "Junior Boys",
  "Junior Girls",
  "Senior Boys",
  "Senior Girls",
];

const FORMATS: {
  value: EventFormat;
  label: string;
  description: string;
}[] = [
  {
    value: "individual",
    label: "Individual",
    description: "One student competes",
  },
  {
    value: "team",
    label: "Group",
    description: "Group competition",
  },
];

const DISCIPLINES = [
  "Visual Arts",
  "Literary Arts",
  "Oratory",
  "Recitation",
  "Vocal Arts",
  "Group Vocal Arts",
  "Performing Arts",
  "Group Performing Arts",
  "Other",
];

const INITIAL_FORM: EventForm = {
  name: "",
  category: "Junior Boys",
  discipline: "Visual Arts",
  format: "individual",
  scoring_format: "individual",
  is_active: true,
};

/* ============================================================
   HELPERS
============================================================ */

function createSlug(name: string, category: string) {
  return `${category}-${name}`
    .toLowerCase()
    .trim()
    .replace(/×/g, "x")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatLabel(format: EventFormat) {
  switch (format) {
    case "relay":
      return "Group";
    case "team":
      return "Group";
    default:
      return "Individual";
  }
}

function disciplineIcon(discipline: string) {
  if (discipline.includes("Arts")) {
    return <Layers3 size={18} />;
  }

  if (discipline === "Oratory" || discipline === "Recitation") {
    return <Activity size={18} />;
  }

  if (discipline === "Vocal Arts") {
    return <Users size={18} />;
  }

  return <Trophy size={18} />;
}

/* ============================================================
   PAGE
============================================================ */

export default function EventsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] =
    useState<EventRow | null>(null);

  const [search, setSearch] = useState("");

  const [categoryFilter, setCategoryFilter] =
    useState<"all" | EventCategory>("all");

  const [formatFilter, setFormatFilter] =
    useState<"all" | EventFormat>("all");

  const [activeOnly, setActiveOnly] =
    useState(false);

  const [form, setForm] =
    useState<EventForm>(INITIAL_FORM);

  /* ============================================================
     LOAD EVENTS
  ============================================================ */

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data, error: loadError } =
        await supabase
          .from("events")
          .select(
            `
              id,
              category,
              name,
              slug,
              discipline,
              format,
              is_active,
              created_at,
              scoring_format
            `
          )
          .order("category", {
            ascending: true,
          })
          .order("discipline", {
            ascending: true,
          })
          .order("name", {
            ascending: true,
          });

      if (loadError) {
        throw new Error(loadError.message);
      }

      const visibleCatalogue = (data ?? []).filter((event: any) => {
        const isGirlsCategory = event.category === "Senior Girls" || event.category === "Junior Girls";
        return !(isGirlsCategory && String(event.name ?? "").trim().toLowerCase() === "duff");
      });
      setEvents(visibleCatalogue as EventRow[]);
    } catch (err) {
      console.error("EVENT LOAD ERROR:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load events."
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  /* ============================================================
     FILTERING
  ============================================================ */

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();

    return events.filter((event) => {
      const matchesSearch =
        !query ||
        event.name.toLowerCase().includes(query) ||
        event.category.toLowerCase().includes(query) ||
        event.discipline.toLowerCase().includes(query) ||
        event.format.toLowerCase().includes(query);

      const matchesCategory =
        categoryFilter === "all" ||
        event.category === categoryFilter;

      const matchesFormat =
        formatFilter === "all" ||
        event.format === formatFilter;

      const matchesActive =
        !activeOnly || event.is_active;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesFormat &&
        matchesActive
      );
    });
  }, [
    events,
    search,
    categoryFilter,
    formatFilter,
    activeOnly,
  ]);

  /* ============================================================
     STATISTICS
  ============================================================ */

  const activeCount = events.filter(
    (event) => event.is_active
  ).length;

  const inactiveCount =
    events.length - activeCount;

  const categoryCount =
    new Set(
      events.map((event) => event.category)
    ).size;

  const individualCount =
    events.filter(
      (event) => event.format === "individual"
    ).length;

  const teamCount =
    events.filter(
      (event) =>
        event.format === "team" ||
        event.format === "relay"
    ).length;

  /* ============================================================
     GROUPING
  ============================================================ */

  const groupedEvents = useMemo(() => {
    const grouped: Record<
      string,
      Record<string, EventRow[]>
    > = {};

    for (const event of filteredEvents) {
      if (!grouped[event.category]) {
        grouped[event.category] = {};
      }

      if (
        !grouped[event.category][event.discipline]
      ) {
        grouped[event.category][event.discipline] =
          [];
      }

      grouped[event.category][event.discipline].push(
        event
      );
    }

    return grouped;
  }, [filteredEvents]);

  /* ============================================================
     MODAL
  ============================================================ */

  function openCreate() {
    setEditingEvent(null);
    setForm(INITIAL_FORM);
    setError("");
    setSuccess("");
    setShowModal(true);
  }

  function openEdit(event: EventRow) {
    setEditingEvent(event);

    setForm({
      name: event.name,
      category: event.category,
      discipline: event.discipline,
      format: event.format,
      scoring_format:
        event.scoring_format ?? event.format,
      is_active: event.is_active,
    });

    setError("");
    setSuccess("");
    setShowModal(true);
  }

  function closeModal() {
    if (saving) return;

    setShowModal(false);
    setEditingEvent(null);
    setForm(INITIAL_FORM);
  }

  /* ============================================================
     SAVE EVENT
  ============================================================ */

  async function saveEvent() {
    const name = form.name.trim();

    if (!name) {
      setError("Event name is required.");
      return;
    }

    if (!form.category) {
      setError("Category is required.");
      return;
    }

    if (!form.discipline) {
      setError("Discipline is required.");
      return;
    }

    const normalizedName = name.trim().toLowerCase();
    if (normalizedName === "duff" && ["Senior Girls", "Junior Girls"].includes(form.category)) {
      setError("Duff is available only in Senior Boys and Junior Boys.");
      return;
    }

    const isBurdaRecitation = normalizedName === "burda recitation";

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const slug = createSlug(
        name,
        form.category
      );

      const payload = {
        category: form.category,
        name,
        slug,
        discipline: form.discipline,
        format: isBurdaRecitation ? "team" : form.format,
        scoring_format: isBurdaRecitation ? "team" : form.scoring_format,
        is_active: form.is_active,
      };

      if (editingEvent) {
        const { data, error: updateError } =
          await supabase
            .from("events")
            .update(payload)
            .eq("id", editingEvent.id)
            .select(
              `
                id,
                category,
                name,
                slug,
                discipline,
                format,
                is_active,
                created_at,
                scoring_format
              `
            )
            .single();

        if (updateError) {
          throw new Error(
            updateError.message
          );
        }

        setEvents((current) =>
          current.map((event) =>
            event.id === editingEvent.id
              ? (data as EventRow)
              : event
          )
        );

        setSuccess(
          "Event updated successfully."
        );
      } else {
        const { data, error: insertError } =
          await supabase
            .from("events")
            .insert(payload)
            .select(
              `
                id,
                category,
                name,
                slug,
                discipline,
                format,
                is_active,
                created_at,
                scoring_format
              `
            )
            .single();

        if (insertError) {
          throw new Error(
            insertError.message
          );
        }

        setEvents((current) =>
          [...current, data as EventRow].sort(
            (a, b) => {
              const categoryCompare =
                a.category.localeCompare(
                  b.category
                );

              if (categoryCompare !== 0) {
                return categoryCompare;
              }

              const disciplineCompare =
                a.discipline.localeCompare(
                  b.discipline
                );

              if (disciplineCompare !== 0) {
                return disciplineCompare;
              }

              return a.name.localeCompare(
                b.name
              );
            }
          )
        );

        setSuccess(
          "Event created successfully."
        );
      }

      window.setTimeout(() => {
        setShowModal(false);
        setEditingEvent(null);
        setForm(INITIAL_FORM);
        setSuccess("");
      }, 700);
    } catch (err) {
      console.error(
        "EVENT SAVE ERROR:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to save event."
      );
    } finally {
      setSaving(false);
    }
  }

  /* ============================================================
     TOGGLE ACTIVE
  ============================================================ */

  async function toggleActive(
    event: EventRow
  ) {
    setError("");
    setSuccess("");

    if (
      !event.is_active &&
      ["Senior Girls", "Junior Girls"].includes(event.category) &&
      event.name.trim().toLowerCase() === "duff"
    ) {
      setError("Duff is available only in Senior Boys and Junior Boys.");
      return;
    }

    try {
      const newStatus =
        !event.is_active;

      const { data, error: updateError } =
        await supabase
          .from("events")
          .update({
            is_active: newStatus,
          })
          .eq("id", event.id)
          .select(
            `
              id,
              category,
              name,
              slug,
              discipline,
              format,
              is_active,
              created_at,
              scoring_format
            `
          )
          .single();

      if (updateError) {
        throw new Error(
          updateError.message
        );
      }

      setEvents((current) =>
        current.map((item) =>
          item.id === event.id
            ? (data as EventRow)
            : item
        )
      );

      setSuccess(
        newStatus
          ? `${event.name} is now active.`
          : `${event.name} has been deactivated.`
      );

      window.setTimeout(() => {
        setSuccess("");
      }, 2500);
    } catch (err) {
      console.error(
        "EVENT STATUS UPDATE ERROR:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to update event status."
      );
    }
  }

  /* ============================================================
     RESET FILTERS
  ============================================================ */

  function resetFilters() {
    setSearch("");
    setCategoryFilter("all");
    setFormatFilter("all");
    setActiveOnly(false);
  }

  /* ============================================================
     RENDER
  ============================================================ */

  return (
    <>
      <main className="eventsPage">
        <div className="eventsContainer">

          {/* ==================================================
              HEADER
          ================================================== */}

          <header className="eventsHeader">
            <div className="eventsHeaderLeft">

              <Link
                href="/admin"
                className="eventsBackLink"
              >
                <ArrowLeft size={15} />
                Dashboard
              </Link>

              <div className="eventsEyebrow">
                <Trophy size={13} />
                SARGAMIYA 2026 / EVENT MANAGEMENT
              </div>

              <h1 className="eventsTitle">
                Events
              </h1>

              <p className="eventsDescription">
                Create, manage and configure the
                official SARGAMIYA 2026 competition
                events.
              </p>

            </div>

            <div className="eventsHeaderActions">

              <button
                type="button"
                className="eventsRefreshButton"
                onClick={() => void loadEvents()}
                disabled={loading}
              >
                <RefreshCw
                  size={16}
                  className={
                    loading
                      ? "eventsSpin"
                      : ""
                  }
                />
                Refresh
              </button>

              <button
                type="button"
                className="eventsPrimaryButton"
                onClick={openCreate}
              >
                <Plus size={17} />
                Add New Event
              </button>

            </div>
          </header>

          {/* ==================================================
              ALERTS
          ================================================== */}

          {error && (
            <div className="eventsAlert eventsAlertError">
              <div>
                <strong>
                  Unable to complete the operation
                </strong>
                <p>{error}</p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setError("")
                }
              >
                <X size={17} />
              </button>
            </div>
          )}

          {success && (
            <div className="eventsAlert eventsAlertSuccess">
              <Check size={17} />
              <span>{success}</span>
            </div>
          )}

          {/* ==================================================
              STATISTICS
          ================================================== */}

          <section className="eventsStats">

            <StatCard
              icon={<Trophy size={19} />}
              label="Total Events"
              value={
                loading
                  ? "—"
                  : String(events.length)
              }
              detail="Configured competitions"
            />

            <StatCard
              icon={<Zap size={19} />}
              label="Active Events"
              value={
                loading
                  ? "—"
                  : String(activeCount)
              }
              detail={
                inactiveCount > 0
                  ? `${inactiveCount} inactive`
                  : "All events active"
              }
            />

            <StatCard
              icon={<Users size={19} />}
              label="Categories"
              value={
                loading
                  ? "—"
                  : String(categoryCount)
              }
              detail="Student categories"
            />

            <StatCard
              icon={<Layers3 size={19} />}
              label="Competition Types"
              value={
                loading
                  ? "—"
                  : String(
                      new Set(
                        events.map(
                          (event) =>
                            event.format
                        )
                      ).size
                    )
              }
              detail={`${individualCount} individual · ${teamCount} group`}
            />

          </section>

          {/* ==================================================
              FILTER PANEL
          ================================================== */}

          <section className="eventsFilterCard">

            <div className="eventsFilterTop">
              <div>
                <div className="eventsSectionEyebrow">
                  EVENT CATALOGUE
                </div>

                <h2>
                  Manage Events
                </h2>

                <p>
                  Search, filter and configure
                  competition events.
                </p>
              </div>

              <div className="eventsResultCount">
                <strong>
                  {filteredEvents.length}
                </strong>
                <span>
                  {filteredEvents.length === 1
                    ? "event shown"
                    : "events shown"}
                </span>
              </div>
            </div>

            <div className="eventsFilters">

              <div className="eventsSearch">
                <Search size={17} />

                <input
                  type="text"
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  placeholder="Search events, categories or disciplines..."
                />

                {search && (
                  <button
                    type="button"
                    onClick={() =>
                      setSearch("")
                    }
                    className="eventsClearSearch"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              <SelectFilter
                value={categoryFilter}
                onChange={(value) =>
                  setCategoryFilter(
                    value as
                      | "all"
                      | EventCategory
                  )
                }
                options={[
                  {
                    value: "all",
                    label: "All Categories",
                  },
                  ...CATEGORIES.map(
                    (category) => ({
                      value: category,
                      label: category,
                    })
                  ),
                ]}
              />

              <SelectFilter
                value={formatFilter}
                onChange={(value) =>
                  setFormatFilter(
                    value as
                      | "all"
                      | EventFormat
                  )
                }
                options={[
                  {
                    value: "all",
                    label: "All Formats",
                  },
                  {
                    value: "individual",
                    label: "Individual",
                  },
                  {
                    value: "team",
                    label: "Group",
                  },
                ]}
              />

              <button
                type="button"
                className={
                  activeOnly
                    ? "eventsActiveFilter eventsActiveFilterOn"
                    : "eventsActiveFilter"
                }
                onClick={() =>
                  setActiveOnly(
                    (value) => !value
                  )
                }
              >
                {activeOnly ? (
                  <ToggleRight size={17} />
                ) : (
                  <ToggleLeft size={17} />
                )}

                Active Only
              </button>

              <button
                type="button"
                className="eventsResetButton"
                onClick={resetFilters}
              >
                Reset
              </button>

            </div>
          </section>

          {/* ==================================================
              EVENT LIST
          ================================================== */}

          {loading ? (
            <LoadingState />
          ) : filteredEvents.length === 0 ? (
            <EmptyState
              search={search}
              onAdd={openCreate}
            />
          ) : (
            <div className="eventsCatalogue">

              {Object.entries(
                groupedEvents
              ).map(
                ([
                  category,
                  disciplines,
                ]) => {

                  const categoryEvents =
                    Object.values(
                      disciplines
                    ).flat();

                  return (
                    <section
                      className="categorySection"
                      key={category}
                    >

                      <div className="categoryHeader">

                        <div>
                          <div className="eventsSectionEyebrow">
                            CATEGORY
                          </div>

                          <h2>
                            {category}
                          </h2>

                          <p>
                            {categoryEvents.length}{" "}
                            {categoryEvents.length ===
                            1
                              ? "event"
                              : "events"}
                          </p>
                        </div>

                        <div className="categoryCount">
                          {categoryEvents.length}
                        </div>

                      </div>

                      {Object.entries(
                        disciplines
                      ).map(
                        ([
                          discipline,
                          disciplineEvents,
                        ]) => (
                          <div
                            className="disciplineSection"
                            key={discipline}
                          >

                            <div className="disciplineHeader">

                              <div className="disciplineIcon">
                                {disciplineIcon(
                                  discipline
                                )}
                              </div>

                              <div>
                                <h3>
                                  {discipline}
                                </h3>

                                <span>
                                  {
                                    disciplineEvents.length
                                  }{" "}
                                  {disciplineEvents.length ===
                                  1
                                    ? "event"
                                    : "events"}
                                </span>
                              </div>

                            </div>

                            <div className="eventGrid">

                              {disciplineEvents.map(
                                (event) => (
                                  <article
                                    className={`eventCard ${
                                      event.is_active
                                        ? ""
                                        : "eventCardInactive"
                                    }`}
                                    key={
                                      event.id
                                    }
                                  >

                                    <div className="eventCardTop">

                                      <span className="categoryPill">
                                        {
                                          event.category
                                        }
                                      </span>

                                      <span
                                        className={
                                          event.is_active
                                            ? "statusPill statusActive"
                                            : "statusPill statusInactive"
                                        }
                                      >
                                        {event.is_active
                                          ? "Active"
                                          : "Inactive"}
                                      </span>

                                    </div>

                                    <div className="eventCardIcon">
                                      {disciplineIcon(
                                        event.discipline
                                      )}
                                    </div>

                                    <h4>
                                      {event.name}
                                    </h4>

                                    <div className="eventMeta">

                                      <span>
                                        {
                                          event.discipline
                                        }
                                      </span>

                                      <span className="metaDot">
                                        •
                                      </span>

                                      <span>
                                        {formatLabel(
                                          event.format
                                        )}
                                      </span>

                                    </div>

                                    <div className="eventCardFooter">

                                      <span className="formatBadge">
                                        {
                                          formatLabel(
                                            event.format
                                          )
                                        }
                                      </span>

                                      <div className="eventActions">

                                        <button
                                          type="button"
                                          className="eventIconButton"
                                          title="Edit event"
                                          onClick={() =>
                                            openEdit(
                                              event
                                            )
                                          }
                                        >
                                          <Edit3
                                            size={15}
                                          />
                                        </button>

                                        <button
                                          type="button"
                                          className={
                                            event.is_active
                                              ? "eventIconButton eventDeactivate"
                                              : "eventIconButton eventActivate"
                                          }
                                          title={
                                            event.is_active
                                              ? "Deactivate event"
                                              : "Activate event"
                                          }
                                          onClick={() =>
                                            void toggleActive(
                                              event
                                            )
                                          }
                                        >
                                          {event.is_active ? (
                                            <ToggleRight
                                              size={17}
                                            />
                                          ) : (
                                            <ToggleLeft
                                              size={17}
                                            />
                                          )}
                                        </button>

                                      </div>

                                    </div>

                                  </article>
                                )
                              )}

                            </div>

                          </div>
                        )
                      )}

                    </section>
                  );
                }
              )}

            </div>
          )}

          {/* ==================================================
              MOBILE ADD
          ================================================== */}

          <button
            type="button"
            className="eventsMobileAdd"
            onClick={openCreate}
            aria-label="Add new event"
          >
            <Plus size={22} />
          </button>

        </div>
      </main>

      {/* ======================================================
          MODAL
      ======================================================= */}

      {showModal && (
        <div
          className="eventModalBackdrop"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeModal();
            }
          }}
        >

          <div className="eventModal">

            {/* Modal Header */}

            <div className="eventModalHeader">

              <div>

                <div className="eventsSectionEyebrow">
                  SARGAMIYA 2026 / EVENT
                </div>

                <h2>
                  {editingEvent
                    ? "Edit Event"
                    : "Add New Event"}
                </h2>

                <p>
                  Configure the event for
                  registration, scheduling and
                  results.
                </p>

              </div>

              <button
                type="button"
                className="eventModalClose"
                onClick={closeModal}
                disabled={saving}
              >
                <X size={19} />
              </button>

            </div>

            {/* Modal Body */}

            <div className="eventModalBody">

              {error && (
                <div className="modalError">
                  {error}
                </div>
              )}

              {/* Event Name */}

              <FormField
                label="Event Name"
                required
              >
                <input
                  className="eventInput"
                  type="text"
                  value={form.name}
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        name:
                          event.target
                            .value,
                      })
                    )
                  }
                  placeholder="e.g. 100 M"
                  autoFocus
                />
              </FormField>

              {/* Category + Discipline */}

              <div className="formGridTwo">

                <FormField
                  label="Category"
                  required
                >
                  <StyledSelect
                    value={form.category}
                    onChange={(value) =>
                      setForm(
                        (current) => ({
                          ...current,
                          category:
                            value as EventCategory,
                        })
                      )
                    }
                    options={CATEGORIES.map(
                      (category) => ({
                        value: category,
                        label: category,
                      })
                    )}
                  />
                </FormField>

                <FormField
                  label="Discipline"
                  required
                >
                  <StyledSelect
                    value={form.discipline}
                    onChange={(value) =>
                      setForm(
                        (current) => ({
                          ...current,
                          discipline:
                            value,
                        })
                      )
                    }
                    options={DISCIPLINES.map(
                      (discipline) => ({
                        value: discipline,
                        label: discipline,
                      })
                    )}
                  />
                </FormField>

              </div>

              {/* Format */}

              <FormField
                label="Event Format"
                required
              >

                <div className="formatOptions">

                  {FORMATS.map(
                    (format) => (
                      <button
                        type="button"
                        key={
                          format.value
                        }
                        className={
                          form.format ===
                          format.value
                            ? "formatOption formatOptionSelected"
                            : "formatOption"
                        }
                        onClick={() =>
                          setForm(
                            (
                              current
                            ) => ({
                              ...current,
                              format:
                                format.value,
                              scoring_format:
                                format.value,
                            })
                          )
                        }
                      >

                        <div className="formatOptionTop">
                          <strong>
                            {
                              format.label
                            }
                          </strong>

                          {form.format ===
                            format.value && (
                            <Check
                              size={16}
                            />
                          )}
                        </div>

                        <span>
                          {
                            format.description
                          }
                        </span>

                      </button>
                    )
                  )}

                </div>

              </FormField>

              {/* Scoring Format */}

              <FormField
                label="Scoring Format"
              >

                <StyledSelect
                  value={
                    form.scoring_format
                  }
                  onChange={(value) =>
                    setForm(
                      (current) => ({
                        ...current,
                        scoring_format:
                          value as EventFormat,
                      })
                    )
                  }
                  options={FORMATS.map(
                    (format) => ({
                      value:
                        format.value,
                      label:
                        format.label,
                    })
                  )}
                />

                <p className="fieldHint">
                  Determines which championship
                  scoring system is applied to
                  this event.
                </p>

              </FormField>

              {/* Active */}

              <div className="activeEventBox">

                <div className="activeEventInfo">

                  <div className="activeEventIcon">
                    <Zap size={17} />
                  </div>

                  <div>
                    <strong>
                      Active Event
                    </strong>

                    <span>
                      Active events are available
                      for registration, teams,
                      scheduling and results.
                    </span>
                  </div>

                </div>

                <button
                  type="button"
                  className={
                    form.is_active
                      ? "switch switchOn"
                      : "switch"
                  }
                  onClick={() =>
                    setForm(
                      (current) => ({
                        ...current,
                        is_active:
                          !current.is_active,
                      })
                    )
                  }
                  aria-label="Toggle event active status"
                >
                  <span />
                </button>

              </div>

              {/* Slug Preview */}

              {form.name.trim() && (
                <div className="slugBox">

                  <div className="slugLabel">
                    GENERATED SLUG
                  </div>

                  <code>
                    {createSlug(
                      form.name,
                      form.category
                    )}
                  </code>

                </div>
              )}

            </div>

            {/* Footer */}

            <div className="eventModalFooter">

              <button
                type="button"
                className="modalCancelButton"
                onClick={closeModal}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="button"
                className="modalSaveButton"
                onClick={() =>
                  void saveEvent()
                }
                disabled={saving}
              >

                {saving ? (
                  <>
                    <span className="buttonSpinner" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    {editingEvent
                      ? "Save Changes"
                      : "Create Event"}
                  </>
                )}

              </button>

            </div>

          </div>
        </div>
      )}

      {/* ======================================================
          PAGE CSS
      ======================================================= */}

      <style jsx global>{`

        /* =====================================================
           BASE
        ===================================================== */

        .eventsPage {
          min-height: 100vh;
          background:
            linear-gradient(
              180deg,
              #f7f9fc 0%,
              #f3f6fa 100%
            );
          color: #0b1f41;
          font-family:
            Geist,
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        .eventsPage *,
        .eventsPage *::before,
        .eventsPage *::after {
          box-sizing: border-box;
        }

        .eventsContainer {
          width: 100%;
          max-width: 1500px;
          margin: 0 auto;
          padding: 34px 42px 80px;
        }

        /* =====================================================
           HEADER
        ===================================================== */

        .eventsHeader {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 30px;
          margin-bottom: 28px;
        }

        .eventsHeaderLeft {
          min-width: 0;
        }

        .eventsBackLink {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 19px;
          color: #71829c;
          text-decoration: none;
          font-size: 13px;
          font-weight: 700;
          transition: color .2s ease;
        }

        .eventsBackLink:hover {
          color: #0b1f41;
        }

        .eventsEyebrow {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 8px;
          color: #7185a4;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .18em;
          text-transform: uppercase;
        }

        .eventsTitle {
          margin: 0;
          color: #0b1f41;
          font-size: clamp(36px, 4vw, 50px);
          line-height: .98;
          letter-spacing: -.055em;
          font-weight: 900;
        }

        .eventsDescription {
          max-width: 650px;
          margin: 11px 0 0;
          color: #687b98;
          font-size: 14px;
          line-height: 1.65;
        }

        .eventsHeaderActions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }

        .eventsRefreshButton,
        .eventsPrimaryButton {
          height: 44px;
          border-radius: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 16px;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          transition:
            transform .18s ease,
            box-shadow .18s ease,
            background .18s ease;
        }

        .eventsRefreshButton {
          border: 1px solid #dbe3ee;
          background: #fff;
          color: #536681;
        }

        .eventsRefreshButton:hover {
          background: #f8fafc;
          transform: translateY(-1px);
        }

        .eventsPrimaryButton {
          border: 1px solid #0b1f41;
          background: #0b1f41;
          color: #fff;
          box-shadow: 0 8px 22px rgba(11,31,65,.14);
        }

        .eventsPrimaryButton:hover {
          background: #132d59;
          transform: translateY(-1px);
          box-shadow: 0 11px 27px rgba(11,31,65,.19);
        }

        .eventsPrimaryButton:disabled,
        .eventsRefreshButton:disabled {
          cursor: not-allowed;
          opacity: .55;
          transform: none;
        }

        /* =====================================================
           ALERTS
        ===================================================== */

        .eventsAlert {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 18px;
          padding: 15px 17px;
          border-radius: 14px;
          font-size: 13px;
        }

        .eventsAlert strong {
          display: block;
          font-weight: 800;
        }

        .eventsAlert p {
          margin: 4px 0 0;
          line-height: 1.5;
        }

        .eventsAlert button {
          border: 0;
          background: transparent;
          color: inherit;
          cursor: pointer;
          opacity: .65;
        }

        .eventsAlertError {
          border: 1px solid #fecaca;
          background: #fff1f2;
          color: #b42318;
        }

        .eventsAlertSuccess {
          align-items: center;
          border: 1px solid #bbf7d0;
          background: #f0fdf4;
          color: #15803d;
          font-weight: 700;
        }

        /* =====================================================
           STATISTICS
        ===================================================== */

        .eventsStats {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .eventStatCard {
          min-width: 0;
          padding: 19px;
          border: 1px solid #e0e7f0;
          border-radius: 16px;
          background: #fff;
          box-shadow: 0 3px 14px rgba(19,42,74,.035);
        }

        .eventStatTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .eventStatIcon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          border-radius: 11px;
          background: #f1f5f9;
          color: #0b1f41;
        }

        .eventStatLabel {
          margin-top: 15px;
          color: #7a8aa2;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: .07em;
          text-transform: uppercase;
        }

        .eventStatValue {
          margin-top: 2px;
          color: #0b1f41;
          font-size: 28px;
          line-height: 1.1;
          letter-spacing: -.035em;
          font-weight: 900;
        }

        .eventStatDetail {
          margin-top: 6px;
          color: #8997ab;
          font-size: 11px;
          line-height: 1.4;
        }

        /* =====================================================
           FILTER CARD
        ===================================================== */

        .eventsFilterCard {
          margin-top: 24px;
          overflow: hidden;
          border: 1px solid #dfe6ef;
          border-radius: 18px;
          background: #fff;
          box-shadow: 0 4px 18px rgba(19,42,74,.035);
        }

        .eventsFilterTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 21px 22px 18px;
          border-bottom: 1px solid #edf1f5;
        }

        .eventsSectionEyebrow {
          color: #8190a6;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: .18em;
          text-transform: uppercase;
        }

        .eventsFilterTop h2 {
          margin: 4px 0 0;
          color: #0b1f41;
          font-size: 18px;
          letter-spacing: -.025em;
          font-weight: 900;
        }

        .eventsFilterTop p {
          margin: 4px 0 0;
          color: #8795a9;
          font-size: 12px;
        }

        .eventsResultCount {
          display: flex;
          align-items: baseline;
          gap: 6px;
          color: #8392a8;
          font-size: 11px;
        }

        .eventsResultCount strong {
          color: #0b1f41;
          font-size: 18px;
          font-weight: 900;
        }

        .eventsFilters {
          display: grid;
          grid-template-columns:
            minmax(260px, 1fr)
            190px
            160px
            auto
            auto;
          gap: 9px;
          padding: 14px;
        }

        .eventsSearch {
          position: relative;
          display: flex;
          align-items: center;
          min-width: 0;
        }

        .eventsSearch > svg {
          position: absolute;
          left: 13px;
          color: #94a3b8;
          pointer-events: none;
        }

        .eventsSearch input {
          width: 100%;
          height: 43px;
          padding: 0 38px 0 39px;
          border: 1px solid #dfe6ef;
          border-radius: 11px;
          background: #f8fafc;
          color: #1e293b;
          outline: none;
          font: inherit;
          font-size: 13px;
          transition:
            border-color .2s ease,
            background .2s ease,
            box-shadow .2s ease;
        }

        .eventsSearch input::placeholder {
          color: #a0acbb;
        }

        .eventsSearch input:focus {
          border-color: #91a2ba;
          background: #fff;
          box-shadow:
            0 0 0 3px
            rgba(11,31,65,.05);
        }

        .eventsClearSearch {
          position: absolute;
          right: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 25px;
          height: 25px;
          border: 0;
          border-radius: 7px;
          background: #e9eef4;
          color: #64748b;
          cursor: pointer;
        }

        .eventsSelectWrap {
          position: relative;
        }

        .eventsSelect {
          width: 100%;
          height: 43px;
          appearance: none;
          padding: 0 35px 0 13px;
          border: 1px solid #dfe6ef;
          border-radius: 11px;
          background: #f8fafc;
          color: #52647e;
          outline: none;
          font: inherit;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .eventsSelect:focus {
          border-color: #91a2ba;
          background: #fff;
        }

        .eventsSelectWrap > svg {
          position: absolute;
          right: 11px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          pointer-events: none;
        }

        .eventsActiveFilter,
        .eventsResetButton {
          height: 43px;
          border-radius: 11px;
          padding: 0 13px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          transition: .18s ease;
        }

        .eventsActiveFilter {
          border: 1px solid #dfe6ef;
          background: #f8fafc;
          color: #64748b;
          white-space: nowrap;
        }

        .eventsActiveFilter:hover {
          background: #fff;
        }

        .eventsActiveFilterOn {
          border-color: #0b1f41;
          background: #0b1f41;
          color: #fff;
        }

        .eventsResetButton {
          border: 1px solid #dfe6ef;
          background: #fff;
          color: #64748b;
        }

        .eventsResetButton:hover {
          background: #f8fafc;
          color: #0b1f41;
        }

        /* =====================================================
           CATALOGUE
        ===================================================== */

        .eventsCatalogue {
          margin-top: 30px;
        }

        .categorySection {
          margin-bottom: 42px;
        }

        .categoryHeader {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 17px;
          padding: 0 2px;
        }

        .categoryHeader h2 {
          margin: 3px 0 0;
          color: #0b1f41;
          font-size: 25px;
          line-height: 1.05;
          letter-spacing: -.04em;
          font-weight: 900;
        }

        .categoryHeader p {
          margin: 5px 0 0;
          color: #8593a7;
          font-size: 12px;
        }

        .categoryCount {
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 36px;
          height: 30px;
          padding: 0 10px;
          border: 1px solid #dfe6ef;
          border-radius: 9px;
          background: #fff;
          color: #0b1f41;
          font-size: 12px;
          font-weight: 900;
        }

        .disciplineSection {
          margin-top: 20px;
        }

        .disciplineHeader {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }

        .disciplineIcon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border: 1px solid #dfe6ef;
          border-radius: 9px;
          background: #fff;
          color: #0b1f41;
        }

        .disciplineHeader h3 {
          margin: 0;
          color: #324663;
          font-size: 13px;
          font-weight: 900;
        }

        .disciplineHeader span {
          display: block;
          margin-top: 2px;
          color: #98a4b4;
          font-size: 10px;
        }

        .eventGrid {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .eventCard {
          position: relative;
          min-width: 0;
          min-height: 190px;
          padding: 16px;
          border: 1px solid #dfe6ef;
          border-radius: 15px;
          background: #fff;
          box-shadow:
            0 3px 13px
            rgba(19,42,74,.035);
          transition:
            transform .18s ease,
            border-color .18s ease,
            box-shadow .18s ease;
        }

        .eventCard:hover {
          transform: translateY(-2px);
          border-color: #b8c5d6;
          box-shadow:
            0 11px 27px
            rgba(19,42,74,.09);
        }

        .eventCardInactive {
          opacity: .68;
          background: #fafbfc;
        }

        .eventCardTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .categoryPill,
        .statusPill,
        .formatBadge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          white-space: nowrap;
          border-radius: 999px;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: .03em;
        }

        .categoryPill {
          padding: 5px 8px;
          background: #f1f5f9;
          color: #66768e;
        }

        .statusPill {
          padding: 4px 7px;
        }

        .statusActive {
          background: #ecfdf3;
          color: #15803d;
        }

        .statusInactive {
          background: #f1f5f9;
          color: #8a98aa;
        }

        .eventCardIcon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          margin-top: 17px;
          border-radius: 10px;
          background: #f5f7fa;
          color: #0b1f41;
        }

        .eventCard h4 {
          margin: 12px 0 0;
          color: #0b1f41;
          font-size: 17px;
          line-height: 1.15;
          letter-spacing: -.025em;
          font-weight: 900;
        }

        .eventMeta {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 7px;
          color: #7c8ba0;
          font-size: 10px;
        }

        .metaDot {
          color: #b3bdc9;
        }

        .eventCardFooter {
          position: absolute;
          right: 16px;
          bottom: 15px;
          left: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .formatBadge {
          padding: 5px 8px;
          border: 1px solid #e1e7ef;
          background: #fff;
          color: #73829a;
        }

        .eventActions {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .eventIconButton {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 31px;
          height: 31px;
          border: 1px solid #e0e6ee;
          border-radius: 8px;
          background: #fff;
          color: #74839a;
          cursor: pointer;
          transition: .18s ease;
        }

        .eventIconButton:hover {
          border-color: #b8c5d6;
          color: #0b1f41;
          background: #f8fafc;
        }

        .eventDeactivate:hover {
          color: #b45309;
          border-color: #fcd34d;
          background: #fffbeb;
        }

        .eventActivate:hover {
          color: #15803d;
          border-color: #86efac;
          background: #f0fdf4;
        }

        /* =====================================================
           EMPTY / LOADING
        ===================================================== */

        .eventsLoading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 330px;
          margin-top: 26px;
          border: 1px solid #dfe6ef;
          border-radius: 17px;
          background: #fff;
        }

        .eventsLoadingSpinner {
          width: 30px;
          height: 30px;
          border: 3px solid #e2e8f0;
          border-top-color: #0b1f41;
          border-radius: 50%;
          animation: eventsSpin 0.8s linear infinite;
        }

        .eventsLoading strong {
          margin-top: 13px;
          color: #334155;
          font-size: 13px;
        }

        .eventsLoading span {
          margin-top: 4px;
          color: #94a3b8;
          font-size: 11px;
        }

        .eventsEmpty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 300px;
          margin-top: 26px;
          padding: 30px;
          border: 1px solid #dfe6ef;
          border-radius: 17px;
          background: #fff;
          text-align: center;
        }

        .eventsEmptyIcon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 52px;
          height: 52px;
          border-radius: 15px;
          background: #f1f5f9;
          color: #94a3b8;
        }

        .eventsEmpty h3 {
          margin: 15px 0 0;
          color: #334155;
          font-size: 16px;
          font-weight: 900;
        }

        .eventsEmpty p {
          max-width: 440px;
          margin: 6px 0 0;
          color: #94a3b8;
          font-size: 12px;
          line-height: 1.5;
        }

        .eventsEmpty button {
          margin-top: 17px;
          height: 39px;
          padding: 0 14px;
          border: 0;
          border-radius: 10px;
          background: #0b1f41;
          color: #fff;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }

        /* =====================================================
           MOBILE ADD
        ===================================================== */

        .eventsMobileAdd {
          position: fixed;
          right: 22px;
          bottom: 22px;
          z-index: 20;
          display: none;
          align-items: center;
          justify-content: center;
          width: 54px;
          height: 54px;
          border: 0;
          border-radius: 50%;
          background: #0b1f41;
          color: #fff;
          box-shadow:
            0 10px 30px
            rgba(11,31,65,.25);
          cursor: pointer;
        }

        /* =====================================================
           MODAL
        ===================================================== */

        .eventModalBackdrop {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 22px;
          background: rgba(5,15,31,.46);
          backdrop-filter: blur(6px);
        }

        .eventModal {
          width: 100%;
          max-width: 650px;
          max-height: 92vh;
          overflow: hidden;
          border: 1px solid #e1e7ef;
          border-radius: 20px;
          background: #fff;
          box-shadow:
            0 30px 80px
            rgba(5,15,31,.22);
        }

        .eventModalHeader {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          padding: 22px 23px;
          border-bottom: 1px solid #edf1f5;
        }

        .eventModalHeader h2 {
          margin: 4px 0 0;
          color: #0b1f41;
          font-size: 22px;
          letter-spacing: -.035em;
          font-weight: 900;
        }

        .eventModalHeader p {
          margin: 5px 0 0;
          color: #8a98aa;
          font-size: 11px;
          line-height: 1.5;
        }

        .eventModalClose {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          width: 35px;
          height: 35px;
          border: 0;
          border-radius: 9px;
          background: #f1f5f9;
          color: #718096;
          cursor: pointer;
        }

        .eventModalClose:hover {
          background: #e8edf3;
          color: #0b1f41;
        }

        .eventModalBody {
          max-height: calc(92vh - 145px);
          overflow-y: auto;
          padding: 22px 23px;
        }

        .modalError {
          margin-bottom: 17px;
          padding: 11px 13px;
          border: 1px solid #fecaca;
          border-radius: 10px;
          background: #fff1f2;
          color: #b42318;
          font-size: 12px;
          font-weight: 700;
        }

        .formField {
          margin-bottom: 18px;
        }

        .formFieldLabel {
          display: block;
          margin-bottom: 7px;
          color: #334663;
          font-size: 11px;
          font-weight: 900;
        }

        .requiredMark {
          color: #dc2626;
        }

        .eventInput {
          width: 100%;
          height: 44px;
          padding: 0 13px;
          border: 1px solid #dce4ed;
          border-radius: 10px;
          background: #f8fafc;
          color: #0b1f41;
          outline: none;
          font: inherit;
          font-size: 13px;
        }

        .eventInput:focus {
          border-color: #8293aa;
          background: #fff;
          box-shadow:
            0 0 0 3px
            rgba(11,31,65,.05);
        }

        .formGridTwo {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 13px;
        }

        .styledSelectWrap {
          position: relative;
        }

        .styledSelect {
          width: 100%;
          height: 44px;
          appearance: none;
          padding: 0 36px 0 13px;
          border: 1px solid #dce4ed;
          border-radius: 10px;
          background: #f8fafc;
          color: #475a75;
          outline: none;
          font: inherit;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .styledSelect:focus {
          border-color: #8293aa;
          background: #fff;
          box-shadow:
            0 0 0 3px
            rgba(11,31,65,.05);
        }

        .styledSelectWrap > svg {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          pointer-events: none;
        }

        .formatOptions {
          display: grid;
          grid-template-columns:
            repeat(3, minmax(0, 1fr));
          gap: 8px;
        }

        .formatOption {
          min-height: 78px;
          padding: 11px;
          border: 1px solid #dfe6ef;
          border-radius: 11px;
          background: #fff;
          text-align: left;
          cursor: pointer;
          transition: .18s ease;
        }

        .formatOption:hover {
          border-color: #b8c5d6;
          background: #f8fafc;
        }

        .formatOptionSelected {
          border-color: #0b1f41;
          background: #f7f9fc;
          box-shadow:
            inset 0 0 0 1px
            #0b1f41;
        }

        .formatOptionTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 5px;
          color: #0b1f41;
        }

        .formatOptionTop strong {
          font-size: 12px;
          font-weight: 900;
        }

        .formatOptionTop svg {
          color: #0b1f41;
        }

        .formatOption > span {
          display: block;
          margin-top: 5px;
          color: #8a98aa;
          font-size: 9px;
          line-height: 1.4;
        }

        .fieldHint {
          margin: 6px 0 0;
          color: #94a3b8;
          font-size: 9px;
          line-height: 1.5;
        }

        .activeEventBox {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-top: 4px;
          padding: 13px;
          border: 1px solid #dfe6ef;
          border-radius: 12px;
          background: #f8fafc;
        }

        .activeEventInfo {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .activeEventIcon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          flex-shrink: 0;
          border-radius: 9px;
          background: #fff;
          color: #0b1f41;
        }

        .activeEventInfo strong {
          display: block;
          color: #334663;
          font-size: 11px;
          font-weight: 900;
        }

        .activeEventInfo span {
          display: block;
          max-width: 430px;
          margin-top: 2px;
          color: #8a98aa;
          font-size: 9px;
          line-height: 1.4;
        }

        .switch {
          position: relative;
          width: 43px;
          height: 24px;
          flex-shrink: 0;
          padding: 0;
          border: 0;
          border-radius: 999px;
          background: #cbd5e1;
          cursor: pointer;
          transition: .2s ease;
        }

        .switch span {
          position: absolute;
          top: 3px;
          left: 3px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #fff;
          box-shadow: 0 2px 5px rgba(0,0,0,.15);
          transition: .2s ease;
        }

        .switchOn {
          background: #0b1f41;
        }

        .switchOn span {
          transform: translateX(19px);
        }

        .slugBox {
          margin-top: 17px;
          padding: 11px 13px;
          border: 1px solid #edf1f5;
          border-radius: 10px;
          background: #fafbfc;
        }

        .slugLabel {
          color: #94a3b8;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: .16em;
        }

        .slugBox code {
          display: block;
          margin-top: 4px;
          overflow-wrap: anywhere;
          color: #64748b;
          font-family:
            ui-monospace,
            SFMono-Regular,
            Menlo,
            Monaco,
            Consolas,
            monospace;
          font-size: 10px;
        }

        .eventModalFooter {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 9px;
          padding: 14px 23px;
          border-top: 1px solid #edf1f5;
          background: #fafbfc;
        }

        .modalCancelButton,
        .modalSaveButton {
          height: 40px;
          padding: 0 15px;
          border-radius: 10px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }

        .modalCancelButton {
          border: 1px solid #dce4ed;
          background: #fff;
          color: #64748b;
        }

        .modalCancelButton:hover {
          background: #f8fafc;
        }

        .modalSaveButton {
          border: 1px solid #0b1f41;
          background: #0b1f41;
          color: #fff;
        }

        .modalSaveButton:hover {
          background: #132d59;
        }

        .modalCancelButton:disabled,
        .modalSaveButton:disabled {
          cursor: not-allowed;
          opacity: .55;
        }

        .buttonSpinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255,255,255,.35);
          border-top-color: #fff;
          border-radius: 50%;
          animation: eventsSpin .7s linear infinite;
        }

        .eventsSpin {
          animation: eventsSpin .8s linear infinite;
        }

        @keyframes eventsSpin {
          to {
            transform: rotate(360deg);
          }
        }

        /* =====================================================
           RESPONSIVE
        ===================================================== */

        @media (max-width: 1200px) {
          .eventsContainer {
            padding-left: 28px;
            padding-right: 28px;
          }

          .eventGrid {
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
          }

          .eventsFilters {
            grid-template-columns:
              minmax(220px, 1fr)
              170px
              150px
              auto;
          }

          .eventsResetButton {
            display: none;
          }
        }

        @media (max-width: 900px) {
          .eventsStats {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .eventsHeader {
            align-items: flex-start;
            flex-direction: column;
          }

          .eventsHeaderActions {
            width: 100%;
          }

          .eventsPrimaryButton {
            flex: 1;
          }

          .eventsFilters {
            grid-template-columns:
              1fr 1fr;
          }

          .eventsSearch {
            grid-column: 1 / -1;
          }

          .eventGrid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .eventsContainer {
            padding: 23px 15px 80px;
          }

          .eventsTitle {
            font-size: 38px;
          }

          .eventsDescription {
            font-size: 12px;
          }

          .eventsHeaderActions {
            display: none;
          }

          .eventsStats {
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }

          .eventStatCard {
            padding: 14px;
          }

          .eventStatValue {
            font-size: 23px;
          }

          .eventsFilterTop {
            align-items: flex-start;
          }

          .eventsResultCount {
            display: none;
          }

          .eventsFilters {
            grid-template-columns: 1fr;
          }

          .eventsSearch {
            grid-column: auto;
          }

          .eventsActiveFilter {
            width: 100%;
          }

          .eventGrid {
            grid-template-columns: 1fr;
          }

          .formatOptions {
            grid-template-columns: 1fr;
          }

          .formGridTwo {
            grid-template-columns: 1fr;
            gap: 0;
          }

          .eventModalBackdrop {
            align-items: flex-end;
            padding: 0;
          }

          .eventModal {
            max-height: 94vh;
            border-radius: 20px 20px 0 0;
          }

          .eventModalBody {
            max-height: calc(94vh - 145px);
          }

          .eventsMobileAdd {
            display: flex;
          }
        }

      `}</style>
    </>
  );
}

/* ============================================================
   COMPONENTS
============================================================ */

function StatCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="eventStatCard">
      <div className="eventStatTop">
        <div className="eventStatIcon">
          {icon}
        </div>
      </div>

      <div className="eventStatLabel">
        {label}
      </div>

      <div className="eventStatValue">
        {value}
      </div>

      <div className="eventStatDetail">
        {detail}
      </div>
    </div>
  );
}

function SelectFilter({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: {
    value: string;
    label: string;
  }[];
}) {
  return (
    <div className="eventsSelectWrap">
      <select
        className="eventsSelect"
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>

      <ChevronDown size={15} />
    </div>
  );
}

function StyledSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: {
    value: string;
    label: string;
  }[];
}) {
  return (
    <div className="styledSelectWrap">
      <select
        className="styledSelect"
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>

      <ChevronDown size={15} />
    </div>
  );
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="formField">
      <label className="formFieldLabel">
        {label}

        {required && (
          <span className="requiredMark">
            {" "}
            *
          </span>
        )}
      </label>

      {children}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="eventsLoading">
      <div className="eventsLoadingSpinner" />

      <strong>
        Loading events...
      </strong>

      <span>
        Reading the live SARGAMIYA event catalogue.
      </span>
    </div>
  );
}

function EmptyState({
  search,
  onAdd,
}: {
  search: string;
  onAdd: () => void;
}) {
  return (
    <div className="eventsEmpty">
      <div className="eventsEmptyIcon">
        <Trophy size={25} />
      </div>

      <h3>
        No events found
      </h3>

      <p>
        {search
          ? "No events match your current search or filters."
          : "There are no configured events yet."}
      </p>

      {!search && (
        <button
          type="button"
          onClick={onAdd}
        >
          <Plus
            size={14}
            style={{
              verticalAlign: "middle",
              marginRight: 5,
            }}
          />
          Add New Event
        </button>
      )}
    </div>
  );
}