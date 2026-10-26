"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

import {
  AlertCircle,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Download,
  Edit3,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Save,
  Trash2,
  Trophy,
  Users,
  X,
} from "lucide-react";

/* ============================================================
   TYPES
============================================================ */

type EventFormat = "individual" | "team" | "relay" | string;

type ResultStatus =
  | "official"
  | "disqualified"
  | "did_not_finish"
  | "did_not_start"
  | string;

type Event = {
  id: string;
  category: string;
  name: string;
  slug: string | null;
  discipline: string;
  format: EventFormat;
  scoring_format: string | null;
  /** Admin-controlled override for events whose results are formally declared. */
  results_declared?: boolean | null;
};

type House = {
  id: string;
  name: string;
};

type Student = {
  id: string;
  admission_no: string | null;
  chest_no: number | string | null;
  name: string;
  class_name: string | null;
  division: string | null;
  category: string | null;
  gender: string | null;
  house_id: string | null;
  is_active: boolean | null;
};

type Registration = {
  id: string;
  student_id: string;
  event_id: string;
  status: string;
  registered_at: string;
  notes: string | null;
  student: Student | null;
};

type Team = {
  id: string;
  event_id: string;
  house_id: string;
  team_name: string | null;
};

type TeamMember = {
  id: string;
  team_id: string;
  student_id: string;
  member_order: number | null;
  student: Student | null;
};

type Result = {
  id: string;
  event_id: string;
  student_id: string | null;
  team_id: string | null;
  position: number | null;
  result_value: number | null;
  result_unit: string | null;
  status: ResultStatus;
  points_awarded: number;
  notes: string | null;
  entered_at: string;
  updated_at: string;
};

type ResultForm = {
  position: string;
  resultValue: string;
  resultUnit: string;
  status: ResultStatus;
  points: string;
  notes: string;
};

type EventProgress = {
  resultCount: number;
  /** Number of distinct podium positions (1st, 2nd, 3rd) with at least one result entered. */
  podiumPositionCount: number;
  hasTopThreePositions: boolean;
  scheduledDate: string | null;
  startTime: string | null;
  endTime: string | null;
};

type EventGroupKey = "declared" | "pending" | "toConduct";

/* ============================================================
   CONSTANTS
============================================================ */

const EMPTY_FORM: ResultForm = {
  position: "",
  resultValue: "",
  resultUnit: "",
  status: "official",
  points: "0",
  notes: "",
};

/* ============================================================
   HELPERS
============================================================ */

function normaliseRelated<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function formatLabel(format: EventFormat) {
  if (format === "individual") return "Individual";
  if (format === "team") return "Group";
  if (format === "relay") return "Group";

  return format;
}

function statusLabel(status: ResultStatus) {
  switch (status) {
    case "official":
      return "Official";

    case "disqualified":
      return "Disqualified";

    case "did_not_finish":
      return "DNF";

    case "did_not_start":
      return "DNS";

    default:
      return status;
  }
}

function positionLabel(position: number | null) {
  if (!position) return "—";

  if (position === 1) return "🥇 1st";
  if (position === 2) return "🥈 2nd";
  if (position === 3) return "🥉 3rd";

  if (position % 10 === 1 && position % 100 !== 11) {
    return `${position}st`;
  }

  if (position % 10 === 2 && position % 100 !== 12) {
    return `${position}nd`;
  }

  if (position % 10 === 3 && position % 100 !== 13) {
    return `${position}rd`;
  }

  return `${position}th`;
}

/*
 * SARGAMIYA SCORING
 *
 * Individual:
 * 1st = 5
 * 2nd = 3
 * 3rd = 1
 *
 * Group events:
 * 1st = 10
 * 2nd = 6
 * 3rd = 4
 *
 * Non-official results receive 0.
 */

function calculatePoints(
  format: EventFormat,
  position: number | null,
  status: ResultStatus
) {
  if (!position) return 0;

  if (status !== "official") {
    return 0;
  }

  const isTeam =
    format === "team" ||
    format === "relay";

  if (isTeam) {
    if (position === 1) return 10;
    if (position === 2) return 6;
    if (position === 3) return 4;

    return 0;
  }

  if (position === 1) return 5;
  if (position === 2) return 3;
  if (position === 3) return 1;

  return 0;
}

function scoreDescription(format: EventFormat) {
  if (
    format === "team" ||
    format === "relay"
  ) {
    return "10 · 6 · 4";
  }

  return "5 · 3 · 1";
}

function eventScheduleTimestamp(date: string | null | undefined, time: string | null | undefined) {
  if (!date || !time) return null;
  const normalisedTime = time.length === 5 ? `${time}:00` : time.slice(0, 8);
  const timestamp = new Date(`${date}T${normalisedTime}`).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function eventDateLabel(date: string | null | undefined) {
  if (!date) return "Date not set";
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function eventTimeLabel(time: string | null | undefined) {
  if (!time) return "Time not set";
  const [hourText, minuteText] = time.slice(0, 5).split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return time.slice(0, 5);
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function classifyEvent(event: Event, progress: EventProgress | undefined, now: number): EventGroupKey {
  const resultCount = progress?.resultCount ?? 0;

  // Admins may explicitly declare an event (including events that do not use a standard podium).
  // Otherwise, the event is declared automatically once 1st, 2nd, and 3rd are all present.
  if (event.results_declared || progress?.hasTopThreePositions) return "declared";

  // Any partial result entry, including only one or two podium positions, remains pending.
  if (resultCount > 0) return "pending";

  const scheduledEnd = eventScheduleTimestamp(
    progress?.scheduledDate,
    progress?.endTime ?? progress?.startTime
  );

  // If the scheduled slot has ended with no result rows, flag the event for results.
  if (scheduledEnd !== null && scheduledEnd < now) return "pending";

  // Future, currently running, unscheduled, or incompletely scheduled events remain in this list.
  return "toConduct";
}

/* ============================================================
   PAGE
============================================================ */

export default function ResultsPage() {
  const supabase = createClient();

  /* ==========================================================
     STATE
  ========================================================== */

  const [events, setEvents] = useState<Event[]>([]);
  const [houses, setHouses] = useState<House[]>([]);
  const [eventProgress, setEventProgress] = useState<Record<string, EventProgress>>({});
  const [eventProgressError, setEventProgressError] = useState<string | null>(null);
  const [classificationNow, setClassificationNow] = useState(() => Date.now());
  const [declaringEventId, setDeclaringEventId] = useState<string | null>(null);

  const [selectedEvent, setSelectedEvent] =
    useState<Event | null>(null);

  const [registrations, setRegistrations] =
    useState<Registration[]>([]);

  const [teams, setTeams] =
    useState<Team[]>([]);

  const [teamMembers, setTeamMembers] =
    useState<TeamMember[]>([]);

  const [students, setStudents] =
    useState<Student[]>([]);

  const [results, setResults] =
    useState<Result[]>([]);

  const [search, setSearch] =
    useState("");

  const [categoryFilter, setCategoryFilter] =
    useState("all");

  const [formatFilter, setFormatFilter] =
    useState("all");

  const [loadingEvents, setLoadingEvents] =
    useState(true);

  const [loadingWorkspace, setLoadingWorkspace] =
    useState(false);

  const [savingKey, setSavingKey] =
    useState<string | null>(null);

  const [editingKey, setEditingKey] =
    useState<string | null>(null);

  const [forms, setForms] =
    useState<Record<string, ResultForm>>({});

  const [error, setError] =
    useState<string | null>(null);

  const [message, setMessage] =
    useState<string | null>(null);

  /* ==========================================================
     LOAD EVENTS
  ========================================================== */

  useEffect(() => {
    void loadEvents();
  }, []);

  async function exportResults() {
    try {
      setMessage("Preparing Excel export…");
      setError(null);
      const response = await fetch("/api/results/export", {
        method: "GET",
        headers: { Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
      });
      if (!response.ok) {
        let detail = "Unable to export results.";
        try {
          const body = await response.json();
          if (typeof body?.error === "string") detail = body.error;
        } catch {}
        throw new Error(detail);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "SARGAMIYA-2026-Results.xlsx";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setMessage("Results exported successfully.");
    } catch (err) {
      console.error("RESULT EXPORT ERROR:", err);
      setError(err instanceof Error ? err.message : "Unable to export results.");
    }
  }

  async function loadEvents() {
    setLoadingEvents(true);
    setError(null);

    try {
      const [eventsResponse, housesResponse] = await Promise.all([
        supabase
          .from("events")
          .select("id,category,name,slug,discipline,format,scoring_format,results_declared")
          .eq("is_active", true)
          .order("category", { ascending: true })
          .order("name", { ascending: true }),
        supabase
          .from("houses")
          .select("id,name")
          .order("name", { ascending: true }),
      ]);

      if (eventsResponse.error) throw new Error(eventsResponse.error.message);
      if (housesResponse.error) throw new Error(housesResponse.error.message);

      const loadedEvents = (eventsResponse.data ?? []) as Event[];
      setEvents(loadedEvents);
      setHouses((housesResponse.data ?? []) as House[]);

      await loadEventProgress(loadedEvents);
    } catch (err) {
      console.error("RESULT EVENTS LOAD ERROR:", err);
      setError(err instanceof Error ? err.message : "Unable to load events.");
    } finally {
      setLoadingEvents(false);
    }
  }

  async function loadEventProgress(eventRows: Event[]) {
    setEventProgressError(null);
    if (eventRows.length === 0) {
      setEventProgress({});
      return;
    }

    const [resultsResponse, scheduleResponse] = await Promise.all([
      supabase.from("results").select("id,event_id,position"),
      supabase.from("event_schedule").select("event_id,scheduled_date,start_time,end_time"),
    ]);

    const queryError = resultsResponse.error ?? scheduleResponse.error;
    if (queryError) {
      setEventProgressError(queryError.message);
      return;
    }

    const resultCounts: Record<string, number> = {};
    const podiumPositions: Record<string, Set<number>> = {};
    const schedules: Record<string, { scheduled_date: string | null; start_time: string | null; end_time: string | null }> = {};

    for (const row of (resultsResponse.data ?? []) as Array<{ id: string; event_id: string; position: number | null }>) {
      resultCounts[row.event_id] = (resultCounts[row.event_id] ?? 0) + 1;
      if (row.position === 1 || row.position === 2 || row.position === 3) {
        if (!podiumPositions[row.event_id]) podiumPositions[row.event_id] = new Set<number>();
        podiumPositions[row.event_id].add(row.position);
      }
    }
    for (const row of (scheduleResponse.data ?? []) as Array<{ event_id: string; scheduled_date: string | null; start_time: string | null; end_time: string | null }>) {
      schedules[row.event_id] = row;
    }

    const next: Record<string, EventProgress> = {};
    for (const event of eventRows) {
      const positionsEntered = podiumPositions[event.id] ?? new Set<number>();
      const podiumPositionCount = positionsEntered.size;
      next[event.id] = {
        resultCount: resultCounts[event.id] ?? 0,
        podiumPositionCount,
        hasTopThreePositions: positionsEntered.has(1) && positionsEntered.has(2) && positionsEntered.has(3),
        scheduledDate: schedules[event.id]?.scheduled_date ?? null,
        startTime: schedules[event.id]?.start_time ?? null,
        endTime: schedules[event.id]?.end_time ?? null,
      };
    }
    setEventProgress(next);
  }

  useEffect(() => {
    const timer = window.setInterval(() => setClassificationNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  /* ==========================================================
     FILTERED EVENTS
  ========================================================== */

  const filteredEvents = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return events.filter((event) => {
      const matchesSearch =
        !query ||
        event.name
          .toLowerCase()
          .includes(query) ||
        event.category
          .toLowerCase()
          .includes(query) ||
        event.discipline
          .toLowerCase()
          .includes(query);

      const matchesCategory =
        categoryFilter === "all" ||
        event.category === categoryFilter;

      const matchesFormat =
        formatFilter === "all" ||
        event.format === formatFilter;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesFormat
      );
    });
  }, [
    events,
    search,
    categoryFilter,
    formatFilter,
  ]);

  const eventGroups = useMemo(() => {
    const groups: Record<EventGroupKey, Event[]> = {
      declared: [],
      pending: [],
      toConduct: [],
    };

    for (const event of filteredEvents) {
      groups[classifyEvent(event, eventProgress[event.id], classificationNow)].push(event);
    }

    const byScheduledTime = (a: Event, b: Event) => {
      const left = eventScheduleTimestamp(eventProgress[a.id]?.scheduledDate, eventProgress[a.id]?.startTime);
      const right = eventScheduleTimestamp(eventProgress[b.id]?.scheduledDate, eventProgress[b.id]?.startTime);
      if (left === null && right === null) return a.name.localeCompare(b.name);
      if (left === null) return 1;
      if (right === null) return -1;
      return left - right;
    };

    groups.declared.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
    groups.pending.sort(byScheduledTime);
    groups.toConduct.sort(byScheduledTime);
    return groups;
  }, [filteredEvents, eventProgress, classificationNow]);

  const categories = useMemo(() => {
    return Array.from(
      new Set(
        events
          .map((event) => event.category)
          .filter(Boolean)
      )
    );
  }, [events]);

  const formats = useMemo(() => {
    return Array.from(
      new Set(
        events
          .map((event) => event.format)
          .filter(Boolean)
      )
    );
  }, [events]);

  /* ==========================================================
     RESULT MAPS
  ========================================================== */

  const resultByStudent = useMemo(() => {
    const map = new Map<
      string,
      Result
    >();

    results.forEach((result) => {
      if (result.student_id) {
        map.set(
          result.student_id,
          result
        );
      }
    });

    return map;
  }, [results]);

  const resultByTeam = useMemo(() => {
    const map = new Map<
      string,
      Result
    >();

    results.forEach((result) => {
      if (result.team_id) {
        map.set(
          result.team_id,
          result
        );
      }
    });

    return map;
  }, [results]);

  /* ==========================================================
     SELECT EVENT
  ========================================================== */

  async function selectEvent(event: Event) {
    setSelectedEvent(event);
    setLoadingWorkspace(true);
    setError(null);
    setMessage(null);
    setEditingKey(null);
    setForms({});

    try {
      /*
       * ------------------------------------------------------
       * RESULTS
       * ------------------------------------------------------
       */

      const resultsResponse =
        await supabase
          .from("results")
          .select(
            `
              id,
              event_id,
              student_id,
              team_id,
              position,
              result_value,
              result_unit,
              status,
              points_awarded,
              notes,
              entered_at,
              updated_at
            `
          )
          .eq(
            "event_id",
            event.id
          )
          .order("position", {
            ascending: true,
            nullsFirst: false,
          });

      if (resultsResponse.error) {
        throw new Error(
          resultsResponse.error.message
        );
      }

      setResults(
        (resultsResponse.data ?? []) as Result[]
      );

      /*
       * ------------------------------------------------------
       * INDIVIDUAL EVENT
       * ------------------------------------------------------
       */

      if (
        event.format ===
        "individual"
      ) {
        const registrationsResponse =
          await supabase
            .from("registrations")
            .select(
              `
                id,
                student_id,
                event_id,
                status,
                registered_at,
                notes,
                students (
                  id,
                  admission_no,
                  chest_no,
                  name,
                  class_name,
                  division,
                  category,
                  gender,
                  house_id,
                  is_active
                )
              `
            )
            .eq(
              "event_id",
              event.id
            )
            .eq(
              "status",
              "registered"
            )
            .order(
              "registered_at",
              {
                ascending: true,
              }
            );

        if (
          registrationsResponse.error
        ) {
          throw new Error(
            registrationsResponse
              .error.message
          );
        }

        const registrationRows =
          (registrationsResponse.data ??
            []) as any[];

        const normalizedRegistrations =
          registrationRows.map(
            (row) => ({
              id: row.id,
              student_id:
                row.student_id,
              event_id:
                row.event_id,
              status: row.status,
              registered_at:
                row.registered_at,
              notes: row.notes,
              student:
                normaliseRelated<Student>(
                  row.students
                ),
            })
          );

        setRegistrations(
          normalizedRegistrations
        );

        setTeams([]);
        setTeamMembers([]);

        /*
         * Load all students needed for
         * reliable house / lookup display.
         */

        const studentsResponse =
          await supabase
            .from("students")
            .select(
              `
                id,
                admission_no,
                chest_no,
                name,
                class_name,
                division,
                category,
                gender,
                house_id,
                is_active
              `
            )
            .order("name");

        if (
          studentsResponse.error
        ) {
          throw new Error(
            studentsResponse.error.message
          );
        }

        setStudents(
          (studentsResponse.data ??
            []) as Student[]
        );
      }

      /*
       * ------------------------------------------------------
       * GROUP EVENT EVENT
       * ------------------------------------------------------
       */

      if (
        event.format === "team" ||
        event.format === "relay"
      ) {
        const teamsResponse =
          await supabase
            .from("event_teams")
            .select(
              `
                id,
                event_id,
                house_id,
                team_name
              `
            )
            .eq(
              "event_id",
              event.id
            )
            .order("team_name", {
              ascending: true,
            });

        if (teamsResponse.error) {
          throw new Error(
            teamsResponse.error.message
          );
        }

        /*
         * Explicitly map the database rows.
         *
         * This avoids the previous:
         *
         * { houses: { name }[] }
         *
         * vs
         *
         * { houses: { name } }
         *
         * TypeScript problem.
         */

        const loadedTeams: Team[] =
          (
            teamsResponse.data ??
            []
          ).map((row: any) => ({
            id: row.id,
            event_id:
              row.event_id,
            house_id:
              row.house_id,
            team_name:
              row.team_name,
          }));

        setTeams(loadedTeams);
        setRegistrations([]);

        /*
         * ----------------------------------------------------
         * TEAM MEMBERS
         * ----------------------------------------------------
         */

        if (
          loadedTeams.length > 0
        ) {
          const teamIds =
            loadedTeams.map(
              (team) => team.id
            );

          const membersResponse =
            await supabase
              .from(
                "event_team_members"
              )
              .select(
                `
                  id,
                  team_id,
                  student_id,
                  member_order,
                  students (
                    id,
                    admission_no,
                    chest_no,
                    name,
                    class_name,
                    division,
                    category,
                    gender,
                    house_id,
                    is_active
                  )
                `
              )
              .in(
                "team_id",
                teamIds
              )
              .order(
                "member_order",
                {
                  ascending: true,
                  nullsFirst: false,
                }
              );

          if (
            membersResponse.error
          ) {
            throw new Error(
              membersResponse
                .error.message
            );
          }

          const memberRows =
            (membersResponse.data ??
              []) as any[];

          const normalizedMembers:
            TeamMember[] =
            memberRows.map(
              (row) => ({
                id: row.id,
                team_id:
                  row.team_id,
                student_id:
                  row.student_id,
                member_order:
                  row.member_order,
                student:
                  normaliseRelated<Student>(
                    row.students
                  ),
              })
            );

          setTeamMembers(
            normalizedMembers
          );

          /*
           * Students are still maintained
           * separately for lookups.
           */

          const studentRows =
            normalizedMembers
              .map(
                (member) =>
                  member.student
              )
              .filter(
                Boolean
              ) as Student[];

          setStudents(
            studentRows
          );
        } else {
          setTeamMembers([]);
          setStudents([]);
        }
      }
    } catch (err) {
      console.error(
        "RESULT WORKSPACE LOAD ERROR:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load event data."
      );

      setRegistrations([]);
      setTeams([]);
      setTeamMembers([]);
      setResults([]);
    } finally {
      setLoadingWorkspace(false);
    }
  }

  /* ==========================================================
     FORM HELPERS
  ========================================================== */

  function getForm(
    type: "student" | "team",
    id: string,
    existing?: Result
  ): ResultForm {
    const key =
      `${type}:${id}`;

    if (forms[key]) {
      return forms[key];
    }

    return {
      position:
        existing?.position !== null &&
        existing?.position !== undefined
          ? String(
              existing.position
            )
          : "",
      resultValue:
        existing?.result_value !==
          null &&
        existing?.result_value !==
          undefined
          ? String(
              existing.result_value
            )
          : "",
      resultUnit:
        existing?.result_unit ??
        "",
      status:
        existing?.status ??
        "official",
      points:
        existing?.points_awarded !==
          null &&
        existing?.points_awarded !==
          undefined
          ? String(
              existing.points_awarded
            )
          : "0",
      notes:
        existing?.notes ??
        "",
    };
  }

  function updateForm(
    type: "student" | "team",
    id: string,
    patch: Partial<ResultForm>,
    existing?: Result
  ) {
    const key =
      `${type}:${id}`;

    const current =
      getForm(
        type,
        id,
        existing
      );

    const next = {
      ...current,
      ...patch,
    };

    /*
     * Automatically calculate points
     * whenever position/status changes.
     */

    if (
      selectedEvent &&
      (
        patch.position !==
          undefined ||
        patch.status !==
          undefined
      )
    ) {
      const position =
        next.position
          ? Number(
              next.position
            )
          : null;

      next.points = String(
        calculatePoints(
          selectedEvent.format,
          position,
          next.status
        )
      );
    }

    setForms(
      (previous) => ({
        ...previous,
        [key]: next,
      })
    );
  }

  /* ==========================================================
     START EDITING
  ========================================================== */

  function startEditing(
    type: "student" | "team",
    id: string,
    existing?: Result
  ) {
    const key =
      `${type}:${id}`;

    setEditingKey(key);

    setForms(
      (previous) => ({
        ...previous,
        [key]: getForm(
          type,
          id,
          existing
        ),
      })
    );

    setError(null);
    setMessage(null);
  }

  function cancelEditing(
    type: "student" | "team",
    id: string
  ) {
    const key =
      `${type}:${id}`;

    setEditingKey(null);

    setForms(
      (previous) => {
        const next = {
          ...previous,
        };

        delete next[key];

        return next;
      }
    );
  }

  /* ==========================================================
     SAVE RESULT
  ========================================================== */

  async function saveResult(
    type: "student" | "team",
    id: string
  ) {
    if (!selectedEvent) {
      return;
    }

    const key =
      `${type}:${id}`;

    const form =
      getForm(
        type,
        id,
        type === "student"
          ? resultByStudent.get(
              id
            )
          : resultByTeam.get(
              id
            )
      );

    const position =
      form.position
        ? Number(
            form.position
          )
        : null;

    const resultValue =
      form.resultValue.trim()
        ? Number(
            form.resultValue
          )
        : null;

    if (
      form.position.trim() &&
      (
        !Number.isInteger(
          position
        ) ||
        position == null ||
        position <= 0
      )
    ) {
      setError(
        "Position must be a positive whole number."
      );

      return;
    }

    if (
      form.resultValue.trim() &&
      (
        resultValue === null ||
        Number.isNaN(
          resultValue
        )
      )
    ) {
      setError(
        "Result value must be a valid number."
      );

      return;
    }

    const calculatedPoints =
      calculatePoints(
        selectedEvent.format,
        position,
        form.status
      );

    setSavingKey(key);
    setError(null);
    setMessage(null);

    try {
      const existing =
        type === "student"
          ? resultByStudent.get(
              id
            )
          : resultByTeam.get(
              id
            );

      const payload = {
        event_id:
          selectedEvent.id,

        student_id:
          type === "student"
            ? id
            : null,

        team_id:
          type === "team"
            ? id
            : null,

        position,

        result_value:
          resultValue,

        result_unit:
          form.resultUnit.trim()
            ? form.resultUnit.trim()
            : null,

        status:
          form.status,

        points_awarded:
          calculatedPoints,

        notes:
          form.notes.trim()
            ? form.notes.trim()
            : null,
      };

      if (existing) {
        const {
          error: updateError,
        } = await supabase
          .from("results")
          .update(
            payload
          )
          .eq(
            "id",
            existing.id
          );

        if (updateError) {
          throw new Error(
            updateError.message
          );
        }
      } else {
        const {
          error: insertError,
        } = await supabase
          .from("results")
          .insert(
            payload
          );

        if (insertError) {
          throw new Error(
            insertError.message
          );
        }
      }

      setEditingKey(null);

      setForms(
        (previous) => {
          const next = {
            ...previous,
          };

          delete next[key];

          return next;
        }
      );

      await reloadResults();
      await loadEventProgress(events);

      setMessage(
        existing
          ? "Result updated successfully."
          : "Result recorded successfully."
      );
    } catch (err) {
      console.error(
        "RESULT SAVE ERROR:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to save result."
      );
    } finally {
      setSavingKey(null);
    }
  }

  /* ==========================================================
     RELOAD RESULTS ONLY
  ========================================================== */

  async function reloadResults() {
    if (!selectedEvent) {
      return;
    }

    const {
      data,
      error: resultsError,
    } = await supabase
      .from("results")
      .select(
        `
          id,
          event_id,
          student_id,
          team_id,
          position,
          result_value,
          result_unit,
          status,
          points_awarded,
          notes,
          entered_at,
          updated_at
        `
      )
      .eq(
        "event_id",
        selectedEvent.id
      )
      .order("position", {
        ascending: true,
        nullsFirst: false,
      });

    if (resultsError) {
      throw new Error(
        resultsError.message
      );
    }

    setResults(
      (data ?? []) as Result[]
    );
  }

  /* ==========================================================
     DELETE RESULT
  ========================================================== */

  async function deleteResult(
    result: Result
  ) {
    const confirmed =
      window.confirm(
        "Delete this result? This action cannot be undone."
      );

    if (!confirmed) {
      return;
    }

    setSavingKey(
      result.student_id
        ? `student:${result.student_id}`
        : `team:${result.team_id}`
    );

    setError(null);
    setMessage(null);

    try {
      const {
        error: deleteError,
      } = await supabase
        .from("results")
        .delete()
        .eq(
          "id",
          result.id
        );

      if (deleteError) {
        throw new Error(
          deleteError.message
        );
      }

      setEditingKey(null);

      await reloadResults();
      await loadEventProgress(events);

      setMessage(
        "Result deleted successfully."
      );
    } catch (err) {
      console.error(
        "RESULT DELETE ERROR:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete result."
      );
    } finally {
      setSavingKey(null);
    }
  }

  async function updateEventDeclaration(event: Event, declared: boolean) {
    if (declaringEventId) return;

    setDeclaringEventId(event.id);
    setError(null);
    setMessage(null);

    try {
      const { data: updatedEvent, error: updateError } = await supabase
        .from("events")
        .update({ results_declared: declared })
        .eq("id", event.id)
        .select("id,results_declared")
        .maybeSingle();

      if (updateError) {
        if (/results_declared|column/i.test(updateError.message)) {
          throw new Error("The result-declaration field is not set up yet. Run supabase/result-declaration.sql in the Supabase SQL Editor, then refresh this page.");
        }
        if (/permission|policy|row-level security/i.test(updateError.message)) {
          throw new Error("Supabase blocked this change. Confirm the result-declaration migration has been run and the signed-in admin has permission to update event declarations.");
        }
        throw new Error(updateError.message);
      }
      if (!updatedEvent) {
        throw new Error("Supabase did not update this event. Check the migration and the signed-in admin's event-update permissions, then try again.");
      }

      setEvents((current) => current.map((row) =>
        row.id === event.id ? { ...row, results_declared: declared } : row
      ));
      setMessage(declared
        ? `${event.name} has been marked as declared.`
        : `Manual declaration removed for ${event.name}. Its status has been recalculated.`);
    } catch (err) {
      console.error("EVENT RESULT DECLARATION ERROR:", err);
      setError(err instanceof Error ? err.message : "Unable to update the event declaration.");
    } finally {
      setDeclaringEventId(null);
    }
  }

  /* ==========================================================
     RESET FILTERS
  ========================================================== */

  function resetFilters() {
    setSearch("");
    setCategoryFilter("all");
    setFormatFilter("all");
  }

  /* ==========================================================
     LOOKUPS
  ========================================================== */

  function getHouseName(
    houseId: string | null
  ) {
    if (!houseId) {
      return "No House";
    }

    return (
      houses.find(
        (house) =>
          house.id === houseId
      )?.name ??
      "Unknown House"
    );
  }

  function getTeamMembers(
    teamId: string
  ) {
    return teamMembers
      .filter(
        (member) =>
          member.team_id ===
          teamId
      )
      .sort(
        (a, b) =>
          (a.member_order ??
            999) -
          (b.member_order ??
            999)
      )
      .map(
        (member) =>
          member.student
      )
      .filter(
        Boolean
      ) as Student[];
  }

  function renderEventCard(event: Event, groupKey: EventGroupKey) {
    const selected = selectedEvent?.id === event.id;
    const progress = eventProgress[event.id];
    const groupLabel = groupKey === "declared" ? "Declared" : groupKey === "pending" ? "Pending" : "To be conducted";
    let progressText = "Not scheduled yet";
    if (groupKey === "declared") {
      progressText = event.results_declared
        ? "Declared manually by an administrator"
        : "Declared · 1st, 2nd & 3rd entered";
    } else if (groupKey === "pending") {
      if ((progress?.resultCount ?? 0) > 0) {
        progressText = `Podium positions: ${progress?.podiumPositionCount ?? 0} / 3 · Results entered: ${progress?.resultCount ?? 0}`;
      } else {
        progressText = "Scheduled event ended · results awaited";
      }
    } else if (progress?.scheduledDate) {
      progressText = `${eventDateLabel(progress.scheduledDate)} · ${eventTimeLabel(progress.startTime)}`;
    }

    const isSavingDeclaration = declaringEventId === event.id;
    const canUndoManualDeclaration = groupKey === "declared" && Boolean(event.results_declared);
    const canManuallyDeclare = groupKey !== "declared";

    return (
      <div
        key={event.id}
        className={`eventCard ${selected ? "selected" : ""} eventCard-${groupKey} ${event.results_declared ? "eventCard-manualDeclared" : ""}`}
      >
        <button
          type="button"
          className="eventCardMain"
          aria-label={`Open results for ${event.name}`}
          onClick={() => void selectEvent(event)}
        >
          <div className="eventCardArrow"><ChevronRight size={14} /></div>
          <div className="eventCardTopline">
            <span className="eventBadge">{event.category}</span>
            <span className={`eventStateBadge eventState-${groupKey}`}>{groupLabel}</span>
          </div>
          <div className="eventName">{event.name}</div>
          <div className="eventMeta">{event.discipline} · {formatLabel(event.scoring_format ?? event.format)}</div>
          <div className={`eventProgressText eventProgress-${groupKey}`}>{progressText}</div>
        </button>
        {(canManuallyDeclare || canUndoManualDeclaration) && (
          <div className="eventCardActions">
            {canManuallyDeclare ? (
              <button
                type="button"
                className="declareResultButton"
                disabled={isSavingDeclaration || declaringEventId !== null}
                onClick={() => void updateEventDeclaration(event, true)}
                aria-label={`Mark ${event.name} as declared result`}
              >
                {isSavingDeclaration ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {isSavingDeclaration ? "Saving…" : "Mark as Declared Result"}
              </button>
            ) : (
              <button
                type="button"
                className="declareResultButton undoDeclareButton"
                disabled={isSavingDeclaration || declaringEventId !== null}
                onClick={() => void updateEventDeclaration(event, false)}
                aria-label={`Undo manual declaration for ${event.name}`}
              >
                {isSavingDeclaration ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={13} />}
                {isSavingDeclaration ? "Saving…" : "Undo Declaration"}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ==========================================================
     PAGE
  ========================================================== */

  return (
    <>
      <style jsx global>{`
        .resultsPage {
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

        .resultsPage *,
        .resultsPage *::before,
        .resultsPage *::after {
          box-sizing: border-box;
        }

        .resultsContainer {
          width: 100%;
          max-width: 1440px;
          margin: 0 auto;
          padding: 36px 42px 70px;
        }

        .resultsBreadcrumb {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 12px;
          color: #8290a5;
          font-size: 12px;
          font-weight: 700;
        }

        .resultsBreadcrumb span:last-child {
          color: #0b1f41;
        }

        .resultsHeader {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 28px;
        }

        .resultsHeaderEyebrow {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
          color: #6e83a2;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        .resultsHeaderTitle {
          margin: 0;
          color: #0b1f41;
          font-size: clamp(32px, 3vw, 44px);
          line-height: 1.05;
          letter-spacing: -0.045em;
          font-weight: 900;
        }

        .resultsHeaderDescription {
          max-width: 680px;
          margin: 10px 0 0;
          color: #687b98;
          font-size: 14px;
          line-height: 1.6;
        }

        .refreshButton {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 40px;
          padding: 0 15px;
          border: 1px solid #dce4ee;
          border-radius: 10px;
          background: white;
          color: #203552;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(11, 31, 65, 0.03);
        }

        .refreshButton:hover {
          background: #f9fbfd;
        }

        .refreshButton:disabled {
          cursor: default;
          opacity: 0.6;
        }

        .resultsNotice {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 18px;
          padding: 13px 15px;
          border-radius: 12px;
          font-size: 13px;
          line-height: 1.45;
        }

        .resultsNotice.success {
          border: 1px solid #bde8d1;
          background: #effbf4;
          color: #147443;
        }

        .resultsNotice.error {
          border: 1px solid #f2caca;
          background: #fff4f4;
          color: #a83232;
        }

        .noticeClose {
          margin-left: auto;
          border: 0;
          background: transparent;
          color: inherit;
          cursor: pointer;
        }

        .eventPanel {
          overflow: hidden;
          border: 1px solid #e0e6ee;
          border-radius: 16px;
          background: white;
          box-shadow: 0 8px 28px rgba(11, 31, 65, 0.045);
        }

        .eventPanelHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 22px;
          border-bottom: 1px solid #edf1f5;
        }

        .eventPanelTitle {
          margin: 0;
          color: #0b1f41;
          font-size: 18px;
          font-weight: 850;
        }

        .eventPanelSubtitle {
          margin: 4px 0 0;
          color: #8492a6;
          font-size: 12px;
        }

        .infoBadge {
          flex: 0 0 auto;
          padding: 7px 10px;
          border: 1px solid #dce5ef;
          border-radius: 9px;
          background: #f8fafc;
          color: #5c6e87;
          font-size: 10px;
          font-weight: 800;
        }

        .eventToolbar {
          display: grid;
          grid-template-columns: minmax(220px, 1fr) 170px 170px auto;
          gap: 10px;
          padding: 16px 22px;
          border-bottom: 1px solid #edf1f5;
          background: #fcfdff;
        }

        .searchBox {
          position: relative;
        }

        .searchBox svg {
          position: absolute;
          left: 13px;
          top: 50%;
          transform: translateY(-50%);
          color: #9aa7b8;
        }

        .controlInput,
        .controlSelect {
          width: 100%;
          height: 42px;
          border: 1px solid #dce4ee;
          border-radius: 10px;
          background: white;
          color: #203552;
          font-size: 12px;
          outline: none;
        }

        .controlInput {
          padding: 0 13px 0 38px;
        }

        .controlSelect {
          padding: 0 12px;
          cursor: pointer;
        }

        .controlInput:focus,
        .controlSelect:focus {
          border-color: #8da5c1;
          box-shadow: 0 0 0 3px rgba(11, 31, 65, 0.06);
        }

        .resetButton {
          height: 42px;
          padding: 0 14px;
          border: 1px solid #dce4ee;
          border-radius: 10px;
          background: white;
          color: #5d6f88;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }

        .resetButton:hover {
          background: #f7f9fb;
        }

        .eventGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          padding: 18px 22px 22px;
        }

        .eventCard {
          position: relative;
          min-height: 134px;
          padding: 16px;
          border: 1px solid #e0e6ee;
          border-radius: 12px;
          background: white;
          color: #0b1f41;
          text-align: left;
          cursor: default;
          transition:
            border-color 150ms ease,
            box-shadow 150ms ease,
            transform 150ms ease;
        }

        .eventCard:hover {
          border-color: #aab9ca;
          box-shadow: 0 8px 20px rgba(11, 31, 65, 0.06);
          transform: translateY(-1px);
        }

        .eventCard.selected {
          border: 2px solid #0b1f41;
          padding: 15px;
          box-shadow: 0 10px 24px rgba(11, 31, 65, 0.08);
        }

        .eventCardArrow {
          position: absolute;
          top: 13px;
          right: 13px;
          display: grid;
          place-items: center;
          width: 25px;
          height: 25px;
          border-radius: 7px;
          background: #f3f6fa;
          color: #8290a5;
        }

        .eventCard.selected .eventCardArrow {
          background: #0b1f41;
          color: white;
        }

        .eventCardMain {
          position: relative;
          display: block;
          width: 100%;
          padding: 0;
          border: 0;
          background: transparent;
          color: inherit;
          text-align: left;
          cursor: pointer;
        }

        .eventCardMain:focus-visible {
          outline: 3px solid rgba(23, 101, 177, .28);
          outline-offset: 4px;
          border-radius: 8px;
        }

        .eventCardActions {
          display: flex;
          align-items: center;
          margin-top: 14px;
          padding-top: 11px;
          border-top: 1px solid #edf1f6;
        }

        .declareResultButton {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          min-height: 33px;
          max-width: 100%;
          padding: 7px 10px;
          border: 1px solid #bde7cc;
          border-radius: 8px;
          background: #effaf3;
          color: #147443;
          font-size: 10px;
          line-height: 1.2;
          font-weight: 850;
          cursor: pointer;
          transition: background 140ms ease, border-color 140ms ease;
        }

        .declareResultButton:hover:not(:disabled) {
          border-color: #8bd0a5;
          background: #e2f7e9;
        }

        .declareResultButton:disabled {
          cursor: wait;
          opacity: .65;
        }

        .undoDeclareButton {
          border-color: #e3d8f3;
          background: #f8f4fd;
          color: #6f48a5;
        }

        .undoDeclareButton:hover:not(:disabled) {
          border-color: #cbb5eb;
          background: #f1e9fb;
        }

        .eventCard-manualDeclared {
          background: linear-gradient(180deg, #ffffff 0%, #f7fcf8 100%);
        }

        .eventBadge {
          display: inline-flex;
          padding: 5px 8px;
          border-radius: 999px;
          background: #f2f5f8;
          color: #708198;
          font-size: 9px;
          font-weight: 800;
        }

        .eventName {
          margin-top: 18px;
          padding-right: 24px;
          color: #0b1f41;
          font-size: 16px;
          line-height: 1.15;
          font-weight: 850;
        }

        .eventMeta {
          margin-top: 8px;
          color: #75859c;
          font-size: 10px;
          font-weight: 700;
        }

        .eventType {
          display: inline-flex;
          margin-top: 10px;
          padding: 4px 7px;
          border: 1px solid #e0e6ee;
          border-radius: 6px;
          color: #60728b;
          font-size: 8px;
          font-weight: 850;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .emptyEvents {
          padding: 50px 20px;
          color: #8795a8;
          text-align: center;
        }

        .eventStatusSections {
          display: flex;
          flex-direction: column;
        }

        .eventStatusSection {
          padding: 18px 22px 22px;
          border-bottom: 1px solid #e8edf3;
        }

        .eventStatusSection:last-child {
          border-bottom: 0;
        }

        .eventStatusHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 0 0 12px;
        }

        .eventStatusHeading {
          display: flex;
          align-items: center;
          gap: 11px;
          min-width: 0;
        }

        .eventStatusIcon {
          display: grid;
          place-items: center;
          width: 38px;
          height: 38px;
          flex: 0 0 auto;
          border-radius: 10px;
          background: #edf9f2;
          color: #16834c;
        }

        .eventStatusSection.pending .eventStatusIcon {
          background: #fff5e8;
          color: #b66b10;
        }

        .eventStatusSection.toConduct .eventStatusIcon {
          background: #edf5ff;
          color: #1765b1;
        }

        .eventStatusTitle {
          margin: 0;
          color: #0b1f41;
          font-size: 15px;
          font-weight: 900;
        }

        .eventStatusDescription {
          margin-top: 4px;
          color: #8190a4;
          font-size: 11px;
          line-height: 1.4;
        }

        .eventStatusCount {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 36px;
          height: 32px;
          padding: 0 10px;
          border: 1px solid #cbe9d7;
          border-radius: 9px;
          background: #f1fbf5;
          color: #147443;
          font-size: 12px;
          font-weight: 900;
        }

        .eventStatusSection.pending .eventStatusCount {
          border-color: #f0d5ad;
          background: #fff8ee;
          color: #a7630d;
        }

        .eventStatusSection.toConduct .eventStatusCount {
          border-color: #cfe0f4;
          background: #f4f8ff;
          color: #205f9c;
        }

        .eventGroupGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }

        .eventCardTopline {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          padding-right: 24px;
        }

        .eventStateBadge {
          display: inline-flex;
          padding: 5px 7px;
          border-radius: 999px;
          background: #edf9f2;
          color: #147443;
          font-size: 8px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .045em;
        }

        .eventState-pending {
          background: #fff4e4;
          color: #a7630d;
        }

        .eventState-toConduct {
          background: #edf5ff;
          color: #205f9c;
        }

        .eventProgressText {
          margin-top: 10px;
          color: #147443;
          font-size: 10px;
          line-height: 1.35;
          font-weight: 800;
        }

        .eventProgress-pending {
          color: #a7630d;
        }

        .eventProgress-toConduct {
          color: #205f9c;
        }

        .eventGroupEmpty {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 16px;
          border: 1px dashed #d9e2ed;
          border-radius: 11px;
          color: #8492a6;
          background: #fcfdff;
          font-size: 12px;
        }

        .eventCard-declared { border-color: #d5e9dd; }
        .eventCard-pending { border-color: #f0dfc3; }
        .eventCard-toConduct { border-color: #d8e5f4; }

        .workspace {
          margin-top: 20px;
          overflow: hidden;
          border: 1px solid #dce4ed;
          border-radius: 16px;
          background: white;
          box-shadow: 0 10px 32px rgba(11, 31, 65, 0.055);
        }

        .workspaceHero {
          background: #0b1f41;
          color: white;
        }

        .workspaceHeroTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 22px 24px;
        }

        .workspaceEyebrow {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-bottom: 9px;
        }

        .workspacePill {
          padding: 5px 8px;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 999px;
          background: rgba(255,255,255,0.07);
          color: rgba(255,255,255,0.75);
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .workspaceTitle {
          margin: 0;
          font-size: 25px;
          line-height: 1.1;
          font-weight: 900;
          letter-spacing: -0.025em;
        }

        .workspaceDescription {
          margin-top: 6px;
          color: rgba(255,255,255,0.62);
          font-size: 12px;
        }

        .addResultButton {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          height: 40px;
          padding: 0 15px;
          border: 0;
          border-radius: 9px;
          background: white;
          color: #0b1f41;
          font-size: 11px;
          font-weight: 850;
          cursor: pointer;
        }

        .workspaceStats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          border-top: 1px solid rgba(255,255,255,0.10);
        }

        .workspaceStat {
          padding: 14px 20px;
          border-right: 1px solid rgba(255,255,255,0.10);
        }

        .workspaceStat:last-child {
          border-right: 0;
        }

        .workspaceStatLabel {
          color: rgba(255,255,255,0.45);
          font-size: 8px;
          font-weight: 850;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .workspaceStatValue {
          margin-top: 4px;
          color: white;
          font-size: 12px;
          font-weight: 800;
        }

        .workspaceContent {
          padding: 0;
        }

        .resultSectionHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 19px 22px;
          border-bottom: 1px solid #edf1f5;
          background: #fcfdff;
        }

        .resultHeading {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .resultHeadingIcon {
          display: grid;
          place-items: center;
          width: 35px;
          height: 35px;
          border-radius: 9px;
          background: #edf3fa;
          color: #0b1f41;
        }

        .resultHeadingTitle {
          margin: 0;
          color: #0b1f41;
          font-size: 14px;
          font-weight: 850;
        }

        .resultHeadingSubtitle {
          margin-top: 3px;
          color: #8a97a8;
          font-size: 10px;
        }

        .resultHint {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #8794a6;
          font-size: 10px;
          font-weight: 750;
        }

        .tableWrap {
          width: 100%;
          overflow-x: auto;
        }

        .resultTable {
          width: 100%;
          min-width: 1080px;
          border-collapse: collapse;
        }

        .resultTable th {
          padding: 10px 13px;
          border-bottom: 1px solid #e5eaf0;
          background: #f7f9fb;
          color: #7b899c;
          font-size: 8px;
          font-weight: 850;
          text-align: left;
          text-transform: uppercase;
          letter-spacing: 0.10em;
          white-space: nowrap;
        }

        .resultTable td {
          padding: 12px 13px;
          border-bottom: 1px solid #edf1f5;
          color: #40516a;
          font-size: 11px;
          vertical-align: middle;
        }

        .resultTable tr:last-child td {
          border-bottom: 0;
        }

        .resultTable tbody tr:hover {
          background: #fbfcfe;
        }

        .editingRow {
          background: #f9fbfe !important;
        }

        .participantCell {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 240px;
        }

        .participantNumber {
          display: grid;
          place-items: center;
          width: 35px;
          height: 35px;
          flex: 0 0 auto;
          border-radius: 9px;
          background: #f0f3f7;
          color: #0b1f41;
          font-size: 10px;
          font-weight: 850;
        }

        .participantName {
          display: block;
          color: #172a45;
          font-size: 11px;
          font-weight: 850;
        }

        .participantMeta {
          margin-top: 3px;
          color: #8a98aa;
          font-size: 9px;
        }

        .houseBadge {
          display: inline-flex;
          padding: 5px 8px;
          border-radius: 6px;
          background: #f2f5f8;
          color: #5c6e87;
          font-size: 9px;
          font-weight: 800;
        }

        .positionBadge {
          display: inline-flex;
          min-width: 62px;
          justify-content: center;
          padding: 6px 8px;
          border-radius: 7px;
          background: #f4f6f8;
          color: #273b58;
          font-size: 10px;
          font-weight: 850;
        }

        .pointsBadge {
          display: inline-flex;
          min-width: 38px;
          justify-content: center;
          padding: 6px 8px;
          border-radius: 7px;
          background: #eef5ff;
          color: #1765b1;
          font-size: 10px;
          font-weight: 850;
        }

        .statusBadge {
          display: inline-flex;
          padding: 6px 8px;
          border-radius: 7px;
          background: #f2f5f8;
          color: #61738a;
          font-size: 9px;
          font-weight: 800;
        }

        .statusBadge.official {
          background: #edf9f2;
          color: #147443;
        }

        .statusBadge.disqualified {
          background: #fff0f0;
          color: #b23535;
        }

        .statusBadge.did_not_finish,
        .statusBadge.did_not_start {
          background: #fff7e9;
          color: #9b6a16;
        }

        .formInput,
        .formSelect {
          width: 100%;
          min-width: 90px;
          height: 34px;
          padding: 0 9px;
          border: 1px solid #d6dfe9;
          border-radius: 7px;
          background: white;
          color: #233752;
          font-size: 10px;
          outline: none;
        }

        .formInput:focus,
        .formSelect:focus {
          border-color: #829ab7;
          box-shadow: 0 0 0 2px rgba(11,31,65,0.06);
        }

        .actionGroup {
          display: flex;
          gap: 5px;
          white-space: nowrap;
        }

        .actionButton {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          min-height: 32px;
          padding: 0 9px;
          border: 1px solid #dce4ed;
          border-radius: 7px;
          background: white;
          color: #5d6f87;
          font-size: 9px;
          font-weight: 800;
          cursor: pointer;
        }

        .actionButton:hover {
          background: #f7f9fb;
        }

        .actionButton.primary {
          border-color: #0b1f41;
          background: #0b1f41;
          color: white;
        }

        .actionButton.danger {
          border-color: #f0d4d4;
          color: #b13a3a;
        }

        .actionButton.danger:hover {
          background: #fff4f4;
        }

        .actionButton:disabled {
          cursor: default;
          opacity: 0.55;
        }

        .teamName {
          color: #172a45;
          font-weight: 850;
        }

        .teamMembers {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          max-width: 360px;
        }

        .memberChip {
          padding: 4px 6px;
          border-radius: 5px;
          background: #f2f5f8;
          color: #687991;
          font-size: 8px;
          font-weight: 700;
        }

        .resultEmpty {
          padding: 60px 20px;
          text-align: center;
        }

        .resultEmptyIcon {
          display: grid;
          place-items: center;
          width: 48px;
          height: 48px;
          margin: 0 auto;
          border-radius: 13px;
          background: #f1f4f7;
          color: #9aa7b8;
        }

        .resultEmptyTitle {
          margin-top: 13px;
          color: #43546c;
          font-size: 13px;
          font-weight: 850;
        }

        .resultEmptyText {
          max-width: 420px;
          margin: 5px auto 0;
          color: #919dad;
          font-size: 10px;
          line-height: 1.5;
        }

        .loadingWorkspace {
          display: flex;
          min-height: 300px;
          align-items: center;
          justify-content: center;
          gap: 9px;
          color: #78889d;
          font-size: 12px;
          font-weight: 750;
        }

        .scoringFooter {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 15px 22px;
          border-top: 1px solid #edf1f5;
          background: #fbfcfe;
        }

        .scoringText {
          color: #8996a8;
          font-size: 9px;
          line-height: 1.5;
        }

        .scoringText strong {
          color: #566a83;
        }

        .scoringValue {
          flex: 0 0 auto;
          padding: 7px 10px;
          border: 1px solid #dce5ef;
          border-radius: 7px;
          background: white;
          color: #526680;
          font-size: 9px;
          font-weight: 850;
        }

        @media (max-width: 1100px) {
          .eventGrid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .eventGroupGrid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .eventToolbar {
            grid-template-columns: 1fr 150px 150px auto;
          }
        }

        @media (max-width: 850px) {
          .resultsContainer {
            padding: 24px 18px 50px;
          }

          .resultsHeader {
            flex-direction: column;
          }

          .eventGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .eventGroupGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .eventToolbar {
            grid-template-columns: 1fr 1fr;
          }

          .searchBox {
            grid-column: 1 / -1;
          }

          .workspaceHeroTop {
            align-items: flex-start;
            flex-direction: column;
          }

          .workspaceStats {
            grid-template-columns: 1fr;
          }

          .workspaceStat {
            border-right: 0;
            border-bottom: 1px solid rgba(255,255,255,0.10);
          }

          .workspaceStat:last-child {
            border-bottom: 0;
          }

          .scoringFooter {
            align-items: flex-start;
            flex-direction: column;
          }
        }

        @media (max-width: 560px) {
          .eventGrid,
          .eventGroupGrid {
            grid-template-columns: 1fr;
          }

          .eventToolbar {
            grid-template-columns: 1fr;
          }

          .searchBox {
            grid-column: auto;
          }
        }
      `}</style>

      <main className="resultsPage">
        <div className="resultsContainer">

          {/* ==================================================
              HEADER
          ================================================== */}

          <div className="resultsBreadcrumb">
            <Trophy size={13} />
            <span>Competitions</span>
            <ChevronRight size={12} />
            <span>Results</span>
          </div>

          <header className="resultsHeader">
            <div>
              <div className="resultsHeaderEyebrow">
                <Trophy size={13} />
                SARGAMIYA 2026
                <span>•</span>
                Competition Control
              </div>

              <h1 className="resultsHeaderTitle">
                Results
              </h1>

              <p className="resultsHeaderDescription">
                Enter, review and manage official
                SARGAMIYA results. House points are
                calculated automatically from
                finishing positions.
              </p>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="refreshButton"
                onClick={() => void exportResults()}
              >
                <Download size={15} />
                Export Excel
              </button>
              <button
                type="button"
                className="refreshButton"
                onClick={() => { void loadEvents(); }}
                disabled={loadingEvents}
              >
                <RefreshCw size={15} className={loadingEvents ? "animate-spin" : ""} />
                Refresh Events
              </button>
            </div>
          </header>

          {/* ==================================================
              NOTICES
          ================================================== */}

          {error && (
            <div className="resultsNotice error">
              <AlertCircle
                size={17}
              />

              <div>
                <strong>
                  Unable to complete
                  the operation
                </strong>

                <div>
                  {error}
                </div>
              </div>

              <button
                type="button"
                className="noticeClose"
                onClick={() =>
                  setError(null)
                }
              >
                <X size={16} />
              </button>
            </div>
          )}

          {message && (
            <div className="resultsNotice success">
              <Check size={17} />

              <strong>
                {message}
              </strong>

              <button
                type="button"
                className="noticeClose"
                onClick={() =>
                  setMessage(null)
                }
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* ==================================================
              EVENT SELECTOR
          ================================================== */}

          <section className="eventPanel">
            <div className="eventPanelHeader">
              <div>
                <h2 className="eventPanelTitle">Event Results Overview</h2>
                <p className="eventPanelSubtitle">
                  Events are grouped by result completion and schedule timing. Select any event to enter, update or review its results.
                </p>
              </div>
              <div className="infoBadge">{filteredEvents.length} events</div>
            </div>

            <div className="eventToolbar">
              <div className="searchBox">
                <Search size={16} />
                <input
                  className="controlInput"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search events..."
                />
              </div>

              <select className="controlSelect" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option value="all">All Categories</option>
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>

              <select className="controlSelect" value={formatFilter} onChange={(event) => setFormatFilter(event.target.value)}>
                <option value="all">All Formats</option>
                {formats.map((format) => <option key={format} value={format}>{formatLabel(format)}</option>)}
              </select>

              <button type="button" className="resetButton" onClick={resetFilters}>Reset</button>
            </div>

            {loadingEvents ? (
              <div className="loadingWorkspace">
                <Loader2 size={20} className="animate-spin" />
                Loading events and result status...
              </div>
            ) : eventProgressError ? (
              <div className="emptyEvents">
                <AlertCircle size={24} style={{ margin: "0 auto", opacity: 0.65, color: "#b66b10" }} />
                <div style={{ marginTop: 10, fontWeight: 800 }}>Event status could not be calculated</div>
                <div style={{ marginTop: 4, fontSize: 11 }}>Check access to results, registrations, event teams and schedule data, then refresh.</div>
                <div style={{ marginTop: 8, fontSize: 10 }}>{eventProgressError}</div>
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="emptyEvents">
                <Search size={24} style={{ margin: "0 auto", opacity: 0.45 }} />
                <div style={{ marginTop: 10, fontWeight: 800 }}>No events found</div>
                <div style={{ marginTop: 4, fontSize: 11 }}>Try changing your search or filters.</div>
              </div>
            ) : (
              <div className="eventStatusSections">
                <section className="eventStatusSection declared" aria-labelledby="declared-results-heading">
                  <div className="eventStatusHeader">
                    <div className="eventStatusHeading">
                      <div className="eventStatusIcon"><CheckCircle2 size={18} /></div>
                      <div>
                        <h3 className="eventStatusTitle" id="declared-results-heading">Declared Results</h3>
                        <div className="eventStatusDescription">Declared manually by an administrator, or with 1st, 2nd and 3rd positions entered.</div>
                      </div>
                    </div>
                    <div className="eventStatusCount">{eventGroups.declared.length}</div>
                  </div>
                  {eventGroups.declared.length ? (
                    <div className="eventGroupGrid">{eventGroups.declared.map((event) => renderEventCard(event, "declared"))}</div>
                  ) : (
                    <div className="eventGroupEmpty"><CheckCircle2 size={16} /> No events have complete result entries yet.</div>
                  )}
                </section>

                <section className="eventStatusSection pending" aria-labelledby="pending-results-heading">
                  <div className="eventStatusHeader">
                    <div className="eventStatusHeading">
                      <div className="eventStatusIcon"><AlertCircle size={18} /></div>
                      <div>
                        <h3 className="eventStatusTitle" id="pending-results-heading">Pending Results</h3>
                        <div className="eventStatusDescription">Events that have ended without results, or have incomplete result entries.</div>
                      </div>
                    </div>
                    <div className="eventStatusCount">{eventGroups.pending.length}</div>
                  </div>
                  {eventGroups.pending.length ? (
                    <div className="eventGroupGrid">{eventGroups.pending.map((event) => renderEventCard(event, "pending"))}</div>
                  ) : (
                    <div className="eventGroupEmpty"><ClipboardList size={16} /> No pending results. All completed events are up to date.</div>
                  )}
                </section>

                <section className="eventStatusSection toConduct" aria-labelledby="to-be-conducted-heading">
                  <div className="eventStatusHeader">
                    <div className="eventStatusHeading">
                      <div className="eventStatusIcon"><CalendarDays size={18} /></div>
                      <div>
                        <h3 className="eventStatusTitle" id="to-be-conducted-heading">To Be Conducted</h3>
                        <div className="eventStatusDescription">Upcoming, currently running, or not-yet-scheduled events without results.</div>
                      </div>
                    </div>
                    <div className="eventStatusCount">{eventGroups.toConduct.length}</div>
                  </div>
                  {eventGroups.toConduct.length ? (
                    <div className="eventGroupGrid">{eventGroups.toConduct.map((event) => renderEventCard(event, "toConduct"))}</div>
                  ) : (
                    <div className="eventGroupEmpty"><CalendarDays size={16} /> No events remain in this category.</div>
                  )}
                </section>
              </div>
            )}
          </section>

          {/* ==================================================
              WORKSPACE
          ================================================== */}

          {selectedEvent && (
            <section className="workspace">

              <div className="workspaceHero">

                <div className="workspaceHeroTop">
                  <div>
                    <div className="workspaceEyebrow">

                      <span className="workspacePill">
                        {selectedEvent.category}
                      </span>

                      <span className="workspacePill">
                        {selectedEvent.discipline}
                      </span>

                      <span className="workspacePill">
                        {formatLabel(
                          selectedEvent.format
                        )}
                      </span>

                    </div>

                    <h2 className="workspaceTitle">
                      {selectedEvent.name}
                    </h2>

                    <p className="workspaceDescription">
                      Enter and manage official
                      competition results.
                    </p>
                  </div>
                </div>

                <div className="workspaceStats">

                  <div className="workspaceStat">
                    <div className="workspaceStatLabel">
                      Event Type
                    </div>

                    <div className="workspaceStatValue">
                      {formatLabel(
                        selectedEvent.format
                      )}
                    </div>
                  </div>

                  <div className="workspaceStat">
                    <div className="workspaceStatLabel">
                      Results Entered
                    </div>

                    <div className="workspaceStatValue">
                      {results.length}
                    </div>
                  </div>

                  <div className="workspaceStat">
                    <div className="workspaceStatLabel">
                      Scoring
                    </div>

                    <div className="workspaceStatValue">
                      {scoreDescription(
                        selectedEvent.format
                      )}
                    </div>
                  </div>

                </div>
              </div>

              {loadingWorkspace ? (
                <div className="loadingWorkspace">
                  <Loader2
                    size={26}
                    className="animate-spin"
                  />
                  Loading event data...
                </div>
              ) : (
                <div className="workspaceContent">

                  {/* =================================================
                      INDIVIDUAL
                  ================================================= */}

                  {selectedEvent.format ===
                    "individual" && (
                    <section>

                      <div className="resultSectionHeader">
                        <div className="resultHeading">

                          <div className="resultHeadingIcon">
                            <Users size={17} />
                          </div>

                          <div>
                            <h3 className="resultHeadingTitle">
                              Individual Results
                            </h3>

                            <p className="resultHeadingSubtitle">
                              {
                                registrations.length
                              }{" "}
                              registered
                              participant
                              {registrations.length !==
                              1
                                ? "s"
                                : ""}
                            </p>
                          </div>

                        </div>

                        <div className="resultHint">
                          <ClipboardList
                            size={14}
                          />
                          Registered students only
                        </div>
                      </div>

                      {registrations.length ===
                      0 ? (
                        <div className="resultEmpty">
                          <div className="resultEmptyIcon">
                            <Users size={22} />
                          </div>

                          <div className="resultEmptyTitle">
                            No registered students
                          </div>

                          <p className="resultEmptyText">
                            Register students for
                            this event before
                            entering results.
                          </p>
                        </div>
                      ) : (
                        <div className="tableWrap">
                          <table className="resultTable">
                            <thead>
                              <tr>
                                <th>
                                  Participant
                                </th>

                                <th>
                                  House
                                </th>

                                <th>
                                  Position
                                </th>

                                <th>
                                  Result
                                </th>

                                <th>
                                  Unit
                                </th>

                                <th>
                                  Status
                                </th>

                                <th>
                                  Points
                                </th>

                                <th>
                                  Action
                                </th>
                              </tr>
                            </thead>

                            <tbody>
                              {registrations.map(
                                (
                                  registration
                                ) => {
                                  const student =
                                    registration.student;

                                  if (
                                    !student
                                  ) {
                                    return (
                                      <tr
                                        key={
                                          registration.id
                                        }
                                      >
                                        <td
                                          colSpan={
                                            8
                                          }
                                        >
                                          Student
                                          record
                                          unavailable.
                                        </td>
                                      </tr>
                                    );
                                  }

                                  const existing =
                                    resultByStudent.get(
                                      student.id
                                    );

                                  const key =
                                    `student:${student.id}`;

                                  const editing =
                                    editingKey ===
                                    key;

                                  const form =
                                    getForm(
                                      "student",
                                      student.id,
                                      existing
                                    );

                                  const position =
                                    form.position
                                      ? Number(
                                          form.position
                                        )
                                      : null;

                                  const previewPoints =
                                    calculatePoints(
                                      selectedEvent.format,
                                      position,
                                      form.status
                                    );

                                  return (
                                    <tr
                                      key={
                                        registration.id
                                      }
                                      className={
                                        editing
                                          ? "editingRow"
                                          : ""
                                      }
                                    >
                                      <td>
                                        <div className="participantCell">

                                          <div className="participantNumber">
                                            {student.chest_no ??
                                              "—"}
                                          </div>

                                          <div>
                                            <span className="participantName">
                                              {
                                                student.name
                                              }
                                            </span>

                                            <div className="participantMeta">
                                              Admission{" "}
                                              {
                                                student.admission_no ??
                                                "—"
                                              }{" "}
                                              ·{" "}
                                              {
                                                student.class_name ??
                                                "—"
                                              }
                                              {student.division
                                                ? ` ${student.division}`
                                                : ""}
                                            </div>
                                          </div>

                                        </div>
                                      </td>

                                      <td>
                                        <span className="houseBadge">
                                          {getHouseName(
                                            student.house_id
                                          )}
                                        </span>
                                      </td>

                                      <td>
                                        {editing ? (
                                          <input
                                            className="formInput"
                                            type="number"
                                            min="1"
                                            value={
                                              form.position
                                            }
                                            onChange={(
                                              event
                                            ) =>
                                              updateForm(
                                                "student",
                                                student.id,
                                                {
                                                  position:
                                                    event
                                                      .target
                                                      .value,
                                                },
                                                existing
                                              )
                                            }
                                          />
                                        ) : (
                                          <span className="positionBadge">
                                            {positionLabel(
                                              existing?.position ??
                                                null
                                            )}
                                          </span>
                                        )}
                                      </td>

                                      <td>
                                        {editing ? (
                                          <input
                                            className="formInput"
                                            type="number"
                                            step="any"
                                            value={
                                              form.resultValue
                                            }
                                            onChange={(
                                              event
                                            ) =>
                                              updateForm(
                                                "student",
                                                student.id,
                                                {
                                                  resultValue:
                                                    event
                                                      .target
                                                      .value,
                                                },
                                                existing
                                              )
                                            }
                                          />
                                        ) : (
                                          existing?.result_value !==
                                          null ? (
                                            <strong>
                                              {
                                                existing?.result_value ?? ""
                                              }
                                            </strong>
                                          ) : (
                                            "—"
                                          )
                                        )}
                                      </td>

                                      <td>
                                        {editing ? (
                                          <input
                                            className="formInput"
                                            value={
                                              form.resultUnit
                                            }
                                            placeholder="e.g. sec"
                                            onChange={(
                                              event
                                            ) =>
                                              updateForm(
                                                "student",
                                                student.id,
                                                {
                                                  resultUnit:
                                                    event
                                                      .target
                                                      .value,
                                                },
                                                existing
                                              )
                                            }
                                          />
                                        ) : (
                                          existing?.result_unit ??
                                          "—"
                                        )}
                                      </td>

                                      <td>
                                        {editing ? (
                                          <select
                                            className="formSelect"
                                            value={
                                              form.status
                                            }
                                            onChange={(
                                              event
                                            ) =>
                                              updateForm(
                                                "student",
                                                student.id,
                                                {
                                                  status:
                                                    event
                                                      .target
                                                      .value,
                                                },
                                                existing
                                              )
                                            }
                                          >
                                            <option value="official">
                                              Official
                                            </option>

                                            <option value="disqualified">
                                              Disqualified
                                            </option>

                                            <option value="did_not_finish">
                                              DNF
                                            </option>

                                            <option value="did_not_start">
                                              DNS
                                            </option>
                                          </select>
                                        ) : (
                                          <span
                                            className={`statusBadge ${
                                              existing?.status ??
                                              "official"
                                            }`}
                                          >
                                            {existing
                                              ? statusLabel(
                                                  existing.status
                                                )
                                              : "No Result"}
                                          </span>
                                        )}
                                      </td>

                                      <td>
                                        {editing ? (
                                          <span className="pointsBadge">
                                            {previewPoints}
                                          </span>
                                        ) : (
                                          <span className="pointsBadge">
                                            {
                                              existing?.points_awarded ??
                                              0
                                            }
                                          </span>
                                        )}
                                      </td>

                                      <td>
                                        {editing ? (
                                          <div className="actionGroup">

                                            <button
                                              type="button"
                                              className="actionButton primary"
                                              disabled={
                                                savingKey ===
                                                key
                                              }
                                              onClick={() =>
                                                void saveResult(
                                                  "student",
                                                  student.id
                                                )
                                              }
                                            >
                                              {savingKey ===
                                              key ? (
                                                <Loader2
                                                  size={12}
                                                  className="animate-spin"
                                                />
                                              ) : (
                                                <Save
                                                  size={12}
                                                />
                                              )}
                                              Save
                                            </button>

                                            <button
                                              type="button"
                                              className="actionButton"
                                              onClick={() =>
                                                cancelEditing(
                                                  "student",
                                                  student.id
                                                )
                                              }
                                            >
                                              <X
                                                size={12}
                                              />
                                            </button>

                                          </div>
                                        ) : (
                                          <div className="actionGroup">

                                            <button
                                              type="button"
                                              className="actionButton"
                                              onClick={() =>
                                                startEditing(
                                                  "student",
                                                  student.id,
                                                  existing
                                                )
                                              }
                                            >
                                              {existing ? (
                                                <>
                                                  <Edit3
                                                    size={12}
                                                  />
                                                  Edit
                                                </>
                                              ) : (
                                                <>
                                                  <Plus
                                                    size={12}
                                                  />
                                                  Add Result
                                                </>
                                              )}
                                            </button>

                                            {existing && (
                                              <button
                                                type="button"
                                                className="actionButton danger"
                                                disabled={
                                                  savingKey ===
                                                  key
                                                }
                                                onClick={() =>
                                                  void deleteResult(
                                                    existing
                                                  )
                                                }
                                              >
                                                <Trash2
                                                  size={12}
                                                />
                                              </button>
                                            )}

                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                }
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </section>
                  )}

                  {/* =================================================
                      GROUP EVENT
                  ================================================= */}

                  {(
                    selectedEvent.format ===
                      "team" ||
                    selectedEvent.format ===
                      "relay"
                  ) && (
                    <section>

                      <div className="resultSectionHeader">
                        <div className="resultHeading">

                          <div className="resultHeadingIcon">
                            <Users size={17} />
                          </div>

                          <div>
                            <h3 className="resultHeadingTitle">
                              Group Event Results
                            </h3>

                            <p className="resultHeadingSubtitle">
                              {teams.length}{" "}
                              registered team
                              {teams.length !==
                              1
                                ? "s"
                                : ""}
                            </p>
                          </div>

                        </div>

                        <div className="resultHint">
                          <Users size={14} />
                          Results are recorded against the team
                        </div>
                      </div>

                      {teams.length ===
                      0 ? (
                        <div className="resultEmpty">
                          <div className="resultEmptyIcon">
                            <Users size={22} />
                          </div>

                          <div className="resultEmptyTitle">
                            No teams registered
                          </div>

                          <p className="resultEmptyText">
                            Create and register teams
                            for this event before
                            entering results.
                          </p>
                        </div>
                      ) : (
                        <div className="tableWrap">
                          <table className="resultTable">
                            <thead>
                              <tr>
                                <th>
                                  Team
                                </th>

                                <th>
                                  House
                                </th>

                                <th>
                                  Members
                                </th>

                                <th>
                                  Position
                                </th>

                                <th>
                                  Result
                                </th>

                                <th>
                                  Unit
                                </th>

                                <th>
                                  Status
                                </th>

                                <th>
                                  Points
                                </th>

                                <th>
                                  Action
                                </th>
                              </tr>
                            </thead>

                            <tbody>
                              {teams.map(
                                (team) => {
                                  const existing =
                                    resultByTeam.get(
                                      team.id
                                    );

                                  const key =
                                    `team:${team.id}`;

                                  const editing =
                                    editingKey ===
                                    key;

                                  const form =
                                    getForm(
                                      "team",
                                      team.id,
                                      existing
                                    );

                                  const position =
                                    form.position
                                      ? Number(
                                          form.position
                                        )
                                      : null;

                                  const previewPoints =
                                    calculatePoints(
                                      selectedEvent.format,
                                      position,
                                      form.status
                                    );

                                  const members =
                                    getTeamMembers(
                                      team.id
                                    );

                                  return (
                                    <tr
                                      key={
                                        team.id
                                      }
                                      className={
                                        editing
                                          ? "editingRow"
                                          : ""
                                      }
                                    >
                                      <td>
                                        <div>
                                          <div className="teamName">
                                            {team.team_name ??
                                              "Unnamed Team"}
                                          </div>

                                          <div className="participantMeta">
                                            Team ID{" "}
                                            {team.id.slice(
                                              0,
                                              8
                                            )}
                                          </div>
                                        </div>
                                      </td>

                                      <td>
                                        <span className="houseBadge">
                                          {getHouseName(
                                            team.house_id
                                          )}
                                        </span>
                                      </td>

                                      <td>
                                        <div className="teamMembers">
                                          {members.length ===
                                          0 ? (
                                            <span className="participantMeta">
                                              No members
                                            </span>
                                          ) : (
                                            members
                                              .slice(
                                                0,
                                                6
                                              )
                                              .map(
                                                (
                                                  member
                                                ) => (
                                                  <span
                                                    key={
                                                      member.id
                                                    }
                                                    className="memberChip"
                                                  >
                                                    {
                                                      member.name
                                                    }
                                                  </span>
                                                )
                                              )
                                          )}

                                          {members.length >
                                            6 && (
                                            <span className="memberChip">
                                              +
                                              {members.length -
                                                6}{" "}
                                              more
                                            </span>
                                          )}
                                        </div>
                                      </td>

                                      <td>
                                        {editing ? (
                                          <input
                                            className="formInput"
                                            type="number"
                                            min="1"
                                            value={
                                              form.position
                                            }
                                            onChange={(
                                              event
                                            ) =>
                                              updateForm(
                                                "team",
                                                team.id,
                                                {
                                                  position:
                                                    event
                                                      .target
                                                      .value,
                                                },
                                                existing
                                              )
                                            }
                                          />
                                        ) : (
                                          <span className="positionBadge">
                                            {positionLabel(
                                              existing?.position ??
                                                null
                                            )}
                                          </span>
                                        )}
                                      </td>

                                      <td>
                                        {editing ? (
                                          <input
                                            className="formInput"
                                            type="number"
                                            step="any"
                                            value={
                                              form.resultValue
                                            }
                                            onChange={(
                                              event
                                            ) =>
                                              updateForm(
                                                "team",
                                                team.id,
                                                {
                                                  resultValue:
                                                    event
                                                      .target
                                                      .value,
                                                },
                                                existing
                                              )
                                            }
                                          />
                                        ) : (
                                          existing?.result_value !==
                                          null ? (
                                            <strong>
                                              {
                                                existing?.result_value ?? ""
                                              }
                                            </strong>
                                          ) : (
                                            "—"
                                          )
                                        )}
                                      </td>

                                      <td>
                                        {editing ? (
                                          <input
                                            className="formInput"
                                            value={
                                              form.resultUnit
                                            }
                                            placeholder="e.g. sec"
                                            onChange={(
                                              event
                                            ) =>
                                              updateForm(
                                                "team",
                                                team.id,
                                                {
                                                  resultUnit:
                                                    event
                                                      .target
                                                      .value,
                                                },
                                                existing
                                              )
                                            }
                                          />
                                        ) : (
                                          existing?.result_unit ??
                                          "—"
                                        )}
                                      </td>

                                      <td>
                                        {editing ? (
                                          <select
                                            className="formSelect"
                                            value={
                                              form.status
                                            }
                                            onChange={(
                                              event
                                            ) =>
                                              updateForm(
                                                "team",
                                                team.id,
                                                {
                                                  status:
                                                    event
                                                      .target
                                                      .value,
                                                },
                                                existing
                                              )
                                            }
                                          >
                                            <option value="official">
                                              Official
                                            </option>

                                            <option value="disqualified">
                                              Disqualified
                                            </option>

                                            <option value="did_not_finish">
                                              DNF
                                            </option>

                                            <option value="did_not_start">
                                              DNS
                                            </option>
                                          </select>
                                        ) : (
                                          <span
                                            className={`statusBadge ${
                                              existing?.status ??
                                              "official"
                                            }`}
                                          >
                                            {existing
                                              ? statusLabel(
                                                  existing.status
                                                )
                                              : "No Result"}
                                          </span>
                                        )}
                                      </td>

                                      <td>
                                        {editing ? (
                                          <span className="pointsBadge">
                                            {previewPoints}
                                          </span>
                                        ) : (
                                          <span className="pointsBadge">
                                            {
                                              existing?.points_awarded ??
                                              0
                                            }
                                          </span>
                                        )}
                                      </td>

                                      <td>
                                        {editing ? (
                                          <div className="actionGroup">

                                            <button
                                              type="button"
                                              className="actionButton primary"
                                              disabled={
                                                savingKey ===
                                                key
                                              }
                                              onClick={() =>
                                                void saveResult(
                                                  "team",
                                                  team.id
                                                )
                                              }
                                            >
                                              {savingKey ===
                                              key ? (
                                                <Loader2
                                                  size={12}
                                                  className="animate-spin"
                                                />
                                              ) : (
                                                <Save
                                                  size={12}
                                                />
                                              )}
                                              Save
                                            </button>

                                            <button
                                              type="button"
                                              className="actionButton"
                                              onClick={() =>
                                                cancelEditing(
                                                  "team",
                                                  team.id
                                                )
                                              }
                                            >
                                              <X
                                                size={12}
                                              />
                                            </button>

                                          </div>
                                        ) : (
                                          <div className="actionGroup">

                                            <button
                                              type="button"
                                              className="actionButton"
                                              onClick={() =>
                                                startEditing(
                                                  "team",
                                                  team.id,
                                                  existing
                                                )
                                              }
                                            >
                                              {existing ? (
                                                <>
                                                  <Edit3
                                                    size={12}
                                                  />
                                                  Edit
                                                </>
                                              ) : (
                                                <>
                                                  <Plus
                                                    size={12}
                                                  />
                                                  Add Result
                                                </>
                                              )}
                                            </button>

                                            {existing && (
                                              <button
                                                type="button"
                                                className="actionButton danger"
                                                disabled={
                                                  savingKey ===
                                                  key
                                                }
                                                onClick={() =>
                                                  void deleteResult(
                                                    existing
                                                  )
                                                }
                                              >
                                                <Trash2
                                                  size={12}
                                                />
                                              </button>
                                            )}

                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                }
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </section>
                  )}

                  {/* =================================================
                      SCORING FOOTER
                  ================================================= */}

                  <div className="scoringFooter">

                    <div className="scoringText">
                      <strong>
                        Scoring rule:
                      </strong>{" "}
                      Individual events award
                      5, 3 and 1 points to
                      1st, 2nd and 3rd.
                      Group events
                      award 10, 6 and 4.
                      Disqualified, DNF and
                      DNS receive 0 points.
                    </div>

                    <div className="scoringValue">
                      {formatLabel(
                        selectedEvent.format
                      )}{" "}
                      ·{" "}
                      {scoreDescription(
                        selectedEvent.format
                      )}
                    </div>

                  </div>

                </div>
              )}
            </section>
          )}

        </div>
      </main>
    </>
  );
}