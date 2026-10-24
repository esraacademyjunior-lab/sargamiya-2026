"use client";

import Link from "next/link";
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  CheckCircle2,
  ClipboardList,
  GripVertical,
  Loader2,
  Search,
  ShieldCheck,
  Trash2,
  Trophy,
  UserPlus,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type EventFormat = "individual" | "relay" | "team";

type Event = {
  id: string;
  category: string;
  name: string;
  discipline: string;
  format: EventFormat;
  scoring_format?: string | null;
};

type House = {
  id: string;
  name: string;
};

type Student = {
  id: string;
  admission_no: string | null;
  chest_no: number | null;
  name: string;
  class_name: string | null;
  division: string | null;
  category: string;
  gender: string | null;
  house_id: string | null;
  is_active: boolean;
};

type Team = {
  id: string;
  event_id: string;
  house_id: string;
  team_name: string;
  event_name: string;
  category: string;
  discipline: string;
  house_name: string;
  format: EventFormat;
  member_count: number;
};

type TeamMember = {
  id: string;
  team_id: string;
  student_id: string;
  member_order: number | null;
  student: Student | null;
};

type RosterKind = "relay" | "doubles" | "team";

const CATEGORIES = [
  "All",
  "Junior Boys",
  "Junior Girls",
  "Senior Boys",
  "Senior Girls",
];

const HOUSE_ORDER = ["Atlas", "Titan", "Olympus"];

function getFormat(event: Event | null): EventFormat {
  if (!event) return "team";
  if (event.format === "relay") return "relay";
  if (event.format === "team") return "team";
  return "individual";
}

function getRosterKind(event: Event | null): RosterKind {
  if (!event) return "team";

  if (getFormat(event) === "relay") {
    return "relay";
  }

  const name = event.name.toLowerCase();
  if (name.includes("doubles") || name.includes("double")) {
    return "doubles";
  }

  return "team";
}

function getRosterLimit(event: Event | null) {
  const kind = getRosterKind(event);
  if (kind === "relay") return 4;
  if (kind === "doubles") return 2;
  return null;
}

function getRosterLabel(event: Event | null) {
  const kind = getRosterKind(event);
  if (kind === "relay") return "Exactly 4 group members";
  if (kind === "doubles") return "Exactly 2 players";
  return "Flexible team roster";
}

function getFormatLabel(event: Event | null) {
  const kind = getRosterKind(event);
  if (kind === "relay") return "Group";
  if (kind === "doubles") return "Doubles";
  return "Group";
}

function houseClass(name: string) {
  if (name === "Atlas") return "teams-house teams-house-atlas";
  if (name === "Titan") return "teams-house teams-house-titan";
  if (name === "Olympus") return "teams-house teams-house-olympus";
  return "teams-house";
}

function formatClass(event: Event | null) {
  const kind = getRosterKind(event);
  if (kind === "relay") return "teams-badge teams-badge-relay";
  if (kind === "doubles") return "teams-badge teams-badge-doubles";
  return "teams-badge teams-badge-team";
}

export default function TeamsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [events, setEvents] = useState<Event[]>([]);
  const [houses, setHouses] = useState<House[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);

  const [categoryFilter, setCategoryFilter] = useState("All");
  const [eventId, setEventId] = useState("");
  const [houseId, setHouseId] = useState("");
  const [teamName, setTeamName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removingTeam, setRemovingTeam] = useState<string | null>(null);
  const [openTeamId, setOpenTeamId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === eventId) ?? null,
    [events, eventId]
  );

  const selectedHouse = useMemo(
    () => houses.find((house) => house.id === houseId) ?? null,
    [houses, houseId]
  );

  const rosterKind = getRosterKind(selectedEvent);
  const maxMembers = getRosterLimit(selectedEvent);

  const teamEvents = useMemo(
    () =>
      events
        .filter((event) => {
          const format = getFormat(event);
          return format === "team" || format === "relay";
        })
        .filter(
          (event) =>
            categoryFilter === "All" || event.category === categoryFilter
        )
        .sort((a, b) => {
          const category = a.category.localeCompare(b.category);
          if (category !== 0) return category;

          const discipline = a.discipline.localeCompare(b.discipline);
          if (discipline !== 0) return discipline;

          return a.name.localeCompare(b.name);
        }),
    [events, categoryFilter]
  );

  const currentHouseTeam = useMemo(
    () =>
      eventId && houseId
        ? teams.find(
            (team) =>
              team.event_id === eventId && team.house_id === houseId
          ) ?? null
        : null,
    [teams, eventId, houseId]
  );

  const filteredStudents = useMemo(() => {
    const query = studentSearch.trim().toLowerCase();
    if (!query) return students;

    return students.filter((student) =>
      [
        student.name,
        student.chest_no?.toString() ?? "",
        student.admission_no ?? "",
        student.class_name ?? "",
        student.division ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [students, studentSearch]);

  const selectedStudents = useMemo(() => {
    const map = new Map(students.map((student) => [student.id, student]));
    return selected
      .map((id) => map.get(id))
      .filter((student): student is Student => Boolean(student));
  }, [students, selected]);

  const totalMembers = useMemo(
    () => teams.reduce((total, team) => total + team.member_count, 0),
    [teams]
  );

  const teamEventCount = useMemo(
    () =>
      events.filter((event) => {
        const format = getFormat(event);
        return format === "team" || format === "relay";
      }).length,
    [events]
  );

  const selectedComplete =
    maxMembers === null
      ? selected.length > 0
      : selected.length === maxMembers;

  async function loadTeams(
    knownEvents: Event[] = events,
    knownHouses: House[] = houses
  ) {
    const { data, error: teamError } = await supabase
      .from("event_teams")
      .select("id,event_id,house_id,team_name");

    if (teamError) throw new Error(teamError.message);

    const rows = (data ?? []) as Array<{
      id: string;
      event_id: string;
      house_id: string;
      team_name: string | null;
    }>;

    if (!rows.length) {
      setTeams([]);
      return;
    }

    const ids = rows.map((row) => row.id);

    const { data: memberRows, error: memberError } = await supabase
      .from("event_team_members")
      .select("team_id")
      .in("team_id", ids);

    if (memberError) throw new Error(memberError.message);

    const counts = new Map<string, number>();
    for (const row of memberRows ?? []) {
      counts.set(row.team_id, (counts.get(row.team_id) ?? 0) + 1);
    }

    const normalized = rows
      .map((row) => {
        const event = knownEvents.find((item) => item.id === row.event_id);
        const house = knownHouses.find((item) => item.id === row.house_id);

        return {
          id: row.id,
          event_id: row.event_id,
          house_id: row.house_id,
          team_name:
            row.team_name ||
            `${house?.name ?? "House"} — ${event?.name ?? "Roster"}`,
          event_name: event?.name ?? "Unknown Event",
          category: event?.category ?? "Unknown Category",
          discipline: event?.discipline ?? "Competition",
          house_name: house?.name ?? "Unknown House",
          format: getFormat(event ?? null),
          member_count: counts.get(row.id) ?? 0,
        } satisfies Team;
      })
      .filter((team) => team.format === "team" || team.format === "relay")
      .sort((a, b) => {
        const category = a.category.localeCompare(b.category);
        if (category !== 0) return category;

        const event = a.event_name.localeCompare(b.event_name);
        if (event !== 0) return event;

        return (
          HOUSE_ORDER.indexOf(a.house_name) -
          HOUSE_ORDER.indexOf(b.house_name)
        );
      });

    setTeams(normalized);
  }

  async function loadInitial() {
    setLoading(true);
    setError("");

    try {
      const [eventsResponse, housesResponse] = await Promise.all([
        supabase
          .from("events")
          .select("id,category,name,discipline,format,scoring_format")
          .eq("is_active", true)
          .order("category", { ascending: true })
          .order("discipline", { ascending: true })
          .order("name", { ascending: true }),
        supabase
          .from("houses")
          .select("id,name")
          .order("name", { ascending: true }),
      ]);

      if (eventsResponse.error) {
        throw new Error(eventsResponse.error.message);
      }

      if (housesResponse.error) {
        throw new Error(housesResponse.error.message);
      }

      const loadedEvents = (eventsResponse.data ?? []) as Event[];
      const loadedHouses = (housesResponse.data ?? []) as House[];

      loadedHouses.sort(
        (a, b) =>
          HOUSE_ORDER.indexOf(a.name) - HOUSE_ORDER.indexOf(b.name)
      );

      setEvents(loadedEvents);
      setHouses(loadedHouses);

      await loadTeams(loadedEvents, loadedHouses);
    } catch (err) {
      console.error("TEAM MANAGEMENT LOAD ERROR:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load team management."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadInitial();
    // Initial data load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadEligibleStudents(
    nextEventId: string,
    nextHouseId: string,
    ownTeamId?: string
  ) {
    setStudents([]);
    setStudentSearch("");

    if (!nextEventId || !nextHouseId) {
      setLoadingStudents(false);
      return;
    }

    const event = events.find((item) => item.id === nextEventId);
    if (!event) return;

    setLoadingStudents(true);
    setError("");

    try {
      const { data: registrations, error: registrationError } = await supabase
        .from("registrations")
        .select("student_id")
        .eq("event_id", nextEventId)
        .eq("status", "registered");

      if (registrationError) {
        throw new Error(registrationError.message);
      }

      const registeredIds = (registrations ?? [])
        .map((row) => row.student_id)
        .filter(Boolean);

      if (!registeredIds.length) {
        setStudents([]);
        return;
      }

      const { data: studentRows, error: studentError } = await supabase
        .from("students")
        .select(
          "id,admission_no,chest_no,name,class_name,division,category,gender,house_id,is_active"
        )
        .in("id", registeredIds)
        .eq("category", event.category)
        .eq("house_id", nextHouseId)
        .eq("is_active", true)
        .order("chest_no", { ascending: true });

      if (studentError) {
        throw new Error(studentError.message);
      }

      let eligible = (studentRows ?? []) as Student[];

      const { data: existingTeams, error: existingTeamError } = await supabase
        .from("event_teams")
        .select("id")
        .eq("event_id", nextEventId);

      if (existingTeamError) {
        throw new Error(existingTeamError.message);
      }

      const existingTeamIds = (existingTeams ?? [])
        .map((row) => row.id)
        .filter(Boolean);

      if (existingTeamIds.length) {
        const { data: existingMembers, error: existingMembersError } =
          await supabase
            .from("event_team_members")
            .select("student_id,team_id")
            .in("team_id", existingTeamIds);

        if (existingMembersError) {
          throw new Error(existingMembersError.message);
        }

        const alreadyAssigned = new Set(
          (existingMembers ?? [])
            .filter((row) => row.team_id !== ownTeamId)
            .map((row) => row.student_id)
            .filter(Boolean)
        );

        eligible = eligible.filter(
          (student) => !alreadyAssigned.has(student.id)
        );
      }

      setStudents(eligible);
    } catch (err) {
      console.error("ELIGIBLE STUDENTS ERROR:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load eligible students."
      );
    } finally {
      setLoadingStudents(false);
    }
  }

  function resetForm() {
    setEventId("");
    setHouseId("");
    setTeamName("");
    setStudents([]);
    setSelected([]);
    setMembers([]);
    setStudentSearch("");
    setOpenTeamId(null);
    setError("");
    setMessage("");
  }

  function handleCategoryChange(category: string) {
    setCategoryFilter(category);
    setEventId("");
    setHouseId("");
    setTeamName("");
    setStudents([]);
    setSelected([]);
    setMembers([]);
    setStudentSearch("");
    setOpenTeamId(null);
    setError("");
    setMessage("");
  }

  function handleEventChange(nextEventId: string) {
    setError("");
    setMessage("");
    setEventId(nextEventId);
    setHouseId("");
    setStudents([]);
    setSelected([]);
    setMembers([]);
    setStudentSearch("");
    setOpenTeamId(null);

    const event = events.find((item) => item.id === nextEventId);
    setTeamName(event ? `${event.name} — Team` : "");
  }

  function handleHouseChange(nextHouseId: string) {
    setError("");
    setMessage("");
    setHouseId(nextHouseId);
    setSelected([]);
    setMembers([]);
    setStudents([]);
    setStudentSearch("");
    setOpenTeamId(null);

    const existing = teams.find(
      (team) => team.event_id === eventId && team.house_id === nextHouseId
    );

    const house = houses.find((item) => item.id === nextHouseId);
    const event = events.find((item) => item.id === eventId);

    if (existing) {
      setTeamName(existing.team_name);
      void openTeam(existing);
      return;
    }

    setTeamName(
      event && house ? `${house.name} — ${event.name}` : ""
    );

    if (eventId && nextHouseId) {
      void loadEligibleStudents(eventId, nextHouseId);
    }
  }

  function toggleStudent(studentId: string) {
    setError("");
    setMessage("");

    setSelected((previous) => {
      if (previous.includes(studentId)) {
        return previous.filter((id) => id !== studentId);
      }

      if (maxMembers !== null && previous.length >= maxMembers) {
        return previous;
      }

      return [...previous, studentId];
    });
  }

  function removeSelected(studentId: string) {
    setSelected((previous) => previous.filter((id) => id !== studentId));
  }

  function moveSelected(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= selected.length) return;

    setSelected((previous) => {
      const next = [...previous];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function openTeam(team: Team) {
    setError("");
    setMessage("");
    setEventId(team.event_id);
    setHouseId(team.house_id);
    setTeamName(team.team_name);
    setOpenTeamId(team.id);
    setMembers([]);
    setSelected([]);
    setLoadingStudents(true);

    try {
      const { data: memberRows, error: memberError } = await supabase
        .from("event_team_members")
        .select("id,team_id,student_id,member_order")
        .eq("team_id", team.id)
        .order("member_order", {
          ascending: true,
          nullsFirst: false,
        });

      if (memberError) {
        throw new Error(memberError.message);
      }

      const rows = (memberRows ?? []) as Array<{
        id: string;
        team_id: string;
        student_id: string;
        member_order: number | null;
      }>;

      const studentIds = rows.map((row) => row.student_id).filter(Boolean);

      let studentMap = new Map<string, Student>();

      if (studentIds.length) {
        const { data: studentRows, error: studentError } = await supabase
          .from("students")
          .select(
            "id,admission_no,chest_no,name,class_name,division,category,gender,house_id,is_active"
          )
          .in("id", studentIds);

        if (studentError) {
          throw new Error(studentError.message);
        }

        studentMap = new Map(
          ((studentRows ?? []) as Student[]).map((student) => [
            student.id,
            student,
          ])
        );
      }

      const normalizedMembers: TeamMember[] = rows.map((row, index) => ({
        id: row.id,
        team_id: row.team_id,
        student_id: row.student_id,
        member_order: row.member_order ?? index + 1,
        student: studentMap.get(row.student_id) ?? null,
      }));

      const existingIds = normalizedMembers.map((member) => member.student_id);

      setMembers(normalizedMembers);
      setSelected(existingIds);

      await loadEligibleStudents(team.event_id, team.house_id, team.id);

      setMembers(normalizedMembers);
      setSelected(existingIds);

      window.setTimeout(() => {
        document
          .getElementById("teams-workspace")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    } catch (err) {
      console.error("OPEN TEAM ERROR:", err);
      setError(
        err instanceof Error ? err.message : "Unable to open the roster."
      );
    } finally {
      setLoadingStudents(false);
    }
  }

  async function saveTeam() {
    setError("");
    setMessage("");

    if (!selectedEvent) {
      setError("Select a group event first.");
      return;
    }

    if (!selectedHouse) {
      setError("Select a House first.");
      return;
    }

    if (!teamName.trim()) {
      setError("Enter a roster name.");
      return;
    }

    if (!selectedComplete) {
      setError(
        maxMembers
          ? `${selectedEvent.name} requires exactly ${maxMembers} members.`
          : "Select at least one team member."
      );
      return;
    }

    setSaving(true);

    try {
      if (currentHouseTeam) {
        const { error: updateError } = await supabase
          .from("event_teams")
          .update({ team_name: teamName.trim() })
          .eq("id", currentHouseTeam.id);

        if (updateError) {
          throw new Error(updateError.message);
        }

        const { error: deleteError } = await supabase
          .from("event_team_members")
          .delete()
          .eq("team_id", currentHouseTeam.id);

        if (deleteError) {
          throw new Error(deleteError.message);
        }

        const { error: memberError } = await supabase
          .from("event_team_members")
          .insert(
            selected.map((studentId, index) => ({
              team_id: currentHouseTeam.id,
              student_id: studentId,
              member_order: index + 1,
            }))
          );

        if (memberError) {
          throw new Error(memberError.message);
        }

        setMessage(
          `${selectedEvent.name} roster updated successfully for ${selectedHouse.name}.`
        );
      } else {
        const teamId = crypto.randomUUID();

        const { error: teamError } = await supabase
          .from("event_teams")
          .insert({
            id: teamId,
            event_id: selectedEvent.id,
            house_id: selectedHouse.id,
            team_name: teamName.trim(),
          });

        if (teamError) {
          throw new Error(teamError.message);
        }

        const { error: memberError } = await supabase
          .from("event_team_members")
          .insert(
            selected.map((studentId, index) => ({
              team_id: teamId,
              student_id: studentId,
              member_order: index + 1,
            }))
          );

        if (memberError) {
          await supabase.from("event_teams").delete().eq("id", teamId);
          throw new Error(
            `The roster was not saved because the student members could not be added: ${memberError.message}`
          );
        }

        setMessage(
          `${selectedEvent.name} roster created successfully for ${selectedHouse.name}.`
        );
      }

      await loadTeams(events, houses);

      if (!currentHouseTeam) {
        setSelected([]);
        setStudents([]);
        setMembers([]);
        setStudentSearch("");
        setOpenTeamId(null);
      }
    } catch (err) {
      console.error("SAVE TEAM ERROR:", err);
      setError(
        err instanceof Error ? err.message : "Unable to save the roster."
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeTeam(team: Team) {
    if (
      !window.confirm(
        `Remove "${team.team_name}"?\n\nThis removes the official roster only. Student event registrations will remain unchanged.`
      )
    ) {
      return;
    }

    setRemovingTeam(team.id);
    setError("");
    setMessage("");

    try {
      const { error: memberError } = await supabase
        .from("event_team_members")
        .delete()
        .eq("team_id", team.id);

      if (memberError) throw new Error(memberError.message);

      const { error: teamError } = await supabase
        .from("event_teams")
        .delete()
        .eq("id", team.id);

      if (teamError) throw new Error(teamError.message);

      setMessage(
        "Roster removed successfully. Student event registrations remain unchanged."
      );

      if (openTeamId === team.id) {
        resetForm();
      }

      await loadTeams(events, houses);
    } catch (err) {
      console.error("REMOVE TEAM ERROR:", err);
      setError(
        err instanceof Error ? err.message : "Unable to remove the roster."
      );
    } finally {
      setRemovingTeam(null);
    }
  }

  if (loading) {
    return (
      <main className="teams-page">
        <div className="teams-loading">
          <Loader2 size={22} className="teams-spin" />
          <span>Loading Group Rosters…</span>
        </div>
      </main>
    );
  }

  return (
    <main className="teams-page">
      <div className="teams-container">
        <header className="teams-header">
          <div>
            <Link href="/admin/registrations" className="teams-back">
              <ArrowLeft size={15} />
              Registration
            </Link>

            <div className="teams-eyebrow">
              <Trophy size={13} />
              SARGAMIYA 2026 / GROUP ROSTERS
            </div>

            <h1>Group Rosters</h1>
            <p>
              Build official House rosters for group-song and group-performing-arts events using students already registered for each event.
            </p>
          </div>

          <div className="teams-header-actions">
            <Link href="/admin/registrations" className="teams-button teams-button-light">
              <ClipboardList size={15} />
              Registration
            </Link>
            <Link href="/admin/results" className="teams-button teams-button-light">
              <Trophy size={15} />
              Results
            </Link>
          </div>
        </header>

        {error && (
          <div className="teams-alert teams-alert-error">
            <AlertCircle size={18} />
            <div>
              <strong>Unable to complete the operation</strong>
              <span>{error}</span>
            </div>
            <button type="button" onClick={() => setError("")} aria-label="Close">
              <X size={16} />
            </button>
          </div>
        )}

        {message && (
          <div className="teams-alert teams-alert-success">
            <CheckCircle2 size={18} />
            <span>{message}</span>
            <button type="button" onClick={() => setMessage("")} aria-label="Close">
              <X size={16} />
            </button>
          </div>
        )}

        <section className="teams-stats">
          <article>
            <div className="teams-stat-icon teams-stat-blue"><Users size={18} /></div>
            <div><span>Saved Rosters</span><strong>{teams.length}</strong></div>
          </article>
          <article>
            <div className="teams-stat-icon teams-stat-violet"><Zap size={18} /></div>
            <div><span>Group Events</span><strong>{teamEventCount}</strong></div>
          </article>
          <article>
            <div className="teams-stat-icon teams-stat-green"><ShieldCheck size={18} /></div>
            <div><span>Rostered Students</span><strong>{totalMembers}</strong></div>
          </article>
        </section>

        <section className="teams-panel" id="teams-workspace">
          <div className="teams-panel-header">
            <div>
              <span className="teams-label">BUILD OFFICIAL ROSTER</span>
              <h2>{currentHouseTeam ? "Edit Group Roster" : "Build Group Roster"}</h2>
              <p>
                Select an event and House. Only registered students from that
                House and category are eligible.
              </p>
            </div>

            {selectedEvent && (
              <span className={formatClass(selectedEvent)}>
                {getFormatLabel(selectedEvent)}
              </span>
            )}
          </div>

          <div className="teams-category-bar">
            <span className="teams-label">STUDENT CATEGORY</span>
            <div className="teams-category-tabs">
              {CATEGORIES.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={
                    categoryFilter === category
                      ? "teams-tab teams-tab-active"
                      : "teams-tab"
                  }
                  onClick={() => handleCategoryChange(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <div className="teams-form-grid">
            <label>
              <span>Event</span>
              <select value={eventId} onChange={(e) => handleEventChange(e.target.value)}>
                <option value="">Select group event</option>
                {teamEvents.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.category} — {event.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>House</span>
              <select
                value={houseId}
                onChange={(e) => handleHouseChange(e.target.value)}
                disabled={!eventId}
              >
                <option value="">Select House</option>
                {houses.map((house) => (
                  <option key={house.id} value={house.id}>{house.name}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Roster Name</span>
              <input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                disabled={!eventId || !houseId}
                placeholder="House — Event"
              />
            </label>
          </div>

          {selectedEvent && selectedHouse && (
            <div className="teams-rule">
              <div className="teams-rule-icon">
                {rosterKind === "relay" ? <GripVertical size={18} /> : <ShieldCheck size={18} />}
              </div>
              <div>
                <strong>{selectedEvent.name}</strong>
                <span>
                  {selectedEvent.category} · {selectedEvent.discipline} ·{" "}
                  {selectedHouse.name} · {getRosterLabel(selectedEvent)}
                </span>
              </div>
            </div>
          )}

          {currentHouseTeam && (
            <div className="teams-existing">
              <AlertCircle size={17} />
              <div>
                <strong>Existing roster loaded</strong>
                <span>
                  You are editing <b>{currentHouseTeam.team_name}</b>. Saving
                  replaces its member composition while keeping the roster ID.
                </span>
              </div>
            </div>
          )}
        </section>

        {selectedEvent && selectedHouse && (
          <section className="teams-selection">
            <div className="teams-selection-header">
              <div>
                <span className="teams-label">ELIGIBLE STUDENTS</span>
                <h2>Select Students</h2>
                <p>
                  Students already assigned to another House roster for this
                  event are excluded.
                </p>
              </div>

              <div className="teams-counts">
                <div><strong>{selected.length}{maxMembers ? ` / ${maxMembers}` : ""}</strong><span>Selected</span></div>
                <div><strong>{students.length}</strong><span>Available</span></div>
              </div>
            </div>

            <div className="teams-search-row">
              <div className="teams-search">
                <Search size={16} />
                <input
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Search by name, chest number, admission number or class"
                />
              </div>
            </div>

            <div className="teams-selection-body">
              <div className="teams-student-area">
                {loadingStudents ? (
                  <div className="teams-empty">
                    <Loader2 size={22} className="teams-spin" />
                    <span>Loading eligible students…</span>
                  </div>
                ) : students.length === 0 ? (
                  <div className="teams-empty">
                    <Users size={25} />
                    <strong>No eligible students</strong>
                    <span>Register students for this event first.</span>
                    <Link href="/admin/registrations" className="teams-button teams-button-dark">
                      <ClipboardList size={14} />
                      Open Registration
                    </Link>
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <div className="teams-empty">
                    <Search size={25} />
                    <strong>No students match your search</strong>
                    <button type="button" className="teams-text-button" onClick={() => setStudentSearch("")}>
                      Clear search
                    </button>
                  </div>
                ) : (
                  <div className="teams-student-grid">
                    {filteredStudents.map((student) => {
                      const checked = selected.includes(student.id);
                      const disabled =
                        !checked &&
                        maxMembers !== null &&
                        selected.length >= maxMembers;

                      return (
                        <button
                          key={student.id}
                          type="button"
                          className={[
                            "teams-student-card",
                            checked ? "teams-student-selected" : "",
                            disabled ? "teams-student-disabled" : "",
                          ].join(" ")}
                          disabled={disabled}
                          onClick={() => toggleStudent(student.id)}
                        >
                          <div className="teams-student-top">
                            <span className="teams-student-icon"><Users size={16} /></span>
                            <span className="teams-check">
                              {checked ? <Check size={14} /> : "+"}
                            </span>
                          </div>
                          <span className="teams-chest">CHEST {student.chest_no ?? "—"}</span>
                          <strong>{student.name}</strong>
                          <span>
                            {student.class_name ?? "Class"}
                            {student.division ? ` · ${student.division}` : ""}
                          </span>
                          <div className="teams-student-bottom">
                            <em>{student.category}</em>
                            {checked && <b>Selected</b>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <aside className="teams-roster-card">
                <div className="teams-roster-header">
                  <div>
                    <span className="teams-label">CURRENT SELECTION</span>
                    <h3>
                      {rosterKind === "relay"
                        ? "Member Order"
                        : rosterKind === "doubles"
                          ? "Doubles Pair"
                          : "Group Members"}
                    </h3>
                  </div>
                  <strong>{selected.length}{maxMembers ? ` / ${maxMembers}` : ""}</strong>
                </div>

                {selectedStudents.length === 0 ? (
                  <div className="teams-roster-empty">
                    Select students from the list.
                  </div>
                ) : (
                  <div className="teams-roster-list">
                    {selectedStudents.map((student, index) => (
                      <div className="teams-roster-row" key={student.id}>
                        {rosterKind === "relay" && (
                          <span className="teams-order">{index + 1}</span>
                        )}
                        <span className="teams-roster-chest">#{student.chest_no ?? "—"}</span>
                        <div>
                          <strong>{student.name}</strong>
                          <span>
                            {student.class_name ?? "Class"}
                            {student.division ? ` · ${student.division}` : ""}
                          </span>
                        </div>

                        {rosterKind === "relay" && (
                          <div className="teams-order-actions">
                            <button type="button" onClick={() => moveSelected(index, -1)} disabled={index === 0} aria-label="Move up">
                              <ArrowUp size={13} />
                            </button>
                            <button type="button" onClick={() => moveSelected(index, 1)} disabled={index === selectedStudents.length - 1} aria-label="Move down">
                              <ArrowDown size={13} />
                            </button>
                          </div>
                        )}

                        <button
                          type="button"
                          className="teams-remove-member"
                          onClick={() => removeSelected(student.id)}
                          aria-label={`Remove ${student.name}`}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="teams-roster-footer">
                  <span>
                    <ShieldCheck size={15} />
                    {maxMembers
                      ? `Select exactly ${maxMembers} group members.`
                      : "Select at least one team member."}
                  </span>
                  <div>
                    <button type="button" className="teams-button teams-button-light" onClick={resetForm} disabled={saving}>
                      <X size={14} />
                      Clear
                    </button>
                    <button
                      type="button"
                      className="teams-button teams-button-dark"
                      onClick={() => void saveTeam()}
                      disabled={saving || loadingStudents || !selectedComplete}
                    >
                      {saving ? <Loader2 size={15} className="teams-spin" /> : <UserPlus size={15} />}
                      {saving ? "Saving…" : currentHouseTeam ? "Update Roster" : "Save Roster"}
                    </button>
                  </div>
                </div>
              </aside>
            </div>
          </section>
        )}

        <section className="teams-panel teams-record">
          <div className="teams-panel-header">
            <div>
              <span className="teams-label">CURRENT RECORD</span>
              <h2>Official Group Rosters</h2>
              <p>Saved House compositions ready for competition and results.</p>
            </div>
            <div className="teams-record-count">
              <strong>{teams.length}</strong>
              <span>Rosters</span>
            </div>
          </div>

          {teams.length === 0 ? (
            <div className="teams-empty teams-record-empty">
              <Users size={28} />
              <strong>No official rosters yet</strong>
              <span>Select an event, House and registered students above.</span>
            </div>
          ) : (
            <div className="teams-roster-table">
              <div className="teams-table-head">
                <span>House</span>
                <span>Event</span>
                <span>Type</span>
                <span>Members</span>
                <span>Action</span>
              </div>

              {teams.map((team) => {
                const event = events.find((item) => item.id === team.event_id) ?? null;
                const isOpen = openTeamId === team.id;
                const kind = getRosterKind(event);

                return (
                  <div className={`teams-table-row ${isOpen ? "teams-table-row-open" : ""}`} key={team.id}>
                    <div><span className={houseClass(team.house_name)}>{team.house_name}</span></div>
                    <div>
                      <strong>{team.event_name}</strong>
                      <span>{team.category} · {team.discipline}</span>
                    </div>
                    <div><span className={formatClass(event)}>{"Group"}</span></div>
                    <div><strong>{team.member_count}{getRosterLimit(event) ? ` / ${getRosterLimit(event)}` : ""}</strong></div>
                    <div className="teams-table-actions">
                      <button type="button" className="teams-button teams-button-light" onClick={() => void openTeam(team)}>
                        <Users size={14} />
                        {isOpen ? "Open" : "View / Edit"}
                      </button>
                      <button
                        type="button"
                        className="teams-button teams-button-danger"
                        onClick={() => void removeTeam(team)}
                        disabled={removingTeam === team.id}
                      >
                        {removingTeam === team.id ? <Loader2 size={14} className="teams-spin" /> : <Trash2 size={14} />}
                        Remove
                      </button>
                    </div>

                    {isOpen && members.length > 0 && (
                      <div className="teams-inline-members">
                        {members.map((member, index) => (
                          <div key={member.id}>
                            {kind === "relay" && <span className="teams-order">{member.member_order ?? index + 1}</span>}
                            <span className="teams-roster-chest">#{member.student?.chest_no ?? "—"}</span>
                            <strong>{member.student?.name ?? "Unknown student"}</strong>
                            <span>
                              {member.student?.class_name ?? ""}
                              {member.student?.division ? ` · ${member.student.division}` : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="teams-workflow-note">
          <div><ShieldCheck size={18} /></div>
          <div>
            <strong>Registration → Roster → Results</strong>
            <span>
              Students are registered for an event first. Group Rosters
              builds the official House roster from those registrations.
              Results are entered against the completed roster.
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}
