"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ClipboardList,
  Loader2,
  FileSpreadsheet,
  UploadCloud,
  RotateCcw,
  Search,
  Trophy,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";

/* ============================================================
   TYPES
============================================================ */

type EventFormat = "individual" | "relay" | "team";

type RegistrationStatus =
  | "registered"
  | "withdrawn"
  | "disqualified";

type Student = {
  id: string;
  admission_no: string;
  chest_no: number;
  name: string;
  class_name: string;
  division: string | null;
  category: string;
  gender: string | null;
  house: string;
};

type Event = {
  id: string;
  category: string;
  name: string;
  discipline: string;
  format: EventFormat;
  scoring_format: EventFormat | null;
};

type Registration = {
  id: string;
  event_id: string;
  status: RegistrationStatus;
  registered_at: string;
  notes: string | null;
  event: Event;
};


type ImportRow = {
  sheet: string;
  chestNo: number | null;
  admissionNo: string;
  name: string;
  className: string;
  eventName: string;
  studentId: string | null;
  eventId: string | null;
  studentFound: boolean;
  eventFound: boolean;
  alreadyRegistered: boolean;
  reason?: string;
};

type ImportSummary = {
  studentsProcessed: number;
  studentsMatched: number;
  studentsNotFound: number;
  registrationsFound: number;
  newRegistrations: number;
  alreadyRegistered: number;
  invalidRegistrations: number;
};

const IMPORT_TRUTHY_MARKS = new Set([
  "✓",
  "✔",
  "☑",
  "yes",
  "y",
  "true",
  "1",
  "x",
  "checked",
]);

function normalizeImportText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[´`'’]/g, "")
    .replace(/[×✕✖]/g, "x")
    .replace(/[–—−]/g, "-")
    .replace(/[^a-z0-9]+/g, "")
    .replace(/^0+/, "");
}

function isImportChecked(value: unknown) {
  if (value === true || value === 1) return true;
  // Excel cells may contain a plain check mark, a heavy check mark, or a
  // checked-box glyph. Remove invisible variation/zero-width characters so
  // the intended mark still works after copy/paste from different sources.
  const normalized = String(value ?? "")
    .normalize("NFKC")
    .replace(/[\uFE0E\uFE0F\u200B\u200C\u200D]/g, "")
    .trim()
    .toLowerCase();
  return IMPORT_TRUTHY_MARKS.has(normalized) || ["✓", "✔", "☑", "√"].includes(normalized);
}

function eventImportAliases(name: string) {
  const n = normalizeImportText(name);
  const aliases = new Set([n]);

  if (n === "4x100" || n === "4x100relay" || n === "4x100mrelay") {
    aliases.add("4x100relay");
    aliases.add("4x100");
  }

  if (n === "4x400" || n === "4x400relay" || n === "4x400mrelay") {
    aliases.add("4x400relay");
    aliases.add("4x400");
  }

  if (n === "shotput") aliases.add("shotput");
  if (n === "tugofwar") aliases.add("tugofwar");
  if (n === "kabbadi" || n === "kabaddi") {
    aliases.add("kabbadi");
    aliases.add("kabaddi");
  }

  return aliases;
}

/* ============================================================
   CONSTANTS
============================================================ */

const FORMAT_LABEL: Record<EventFormat, string> = {
  individual: "Individual",
  relay: "Group",
  team: "Group",
};

const STATUS_LABEL: Record<RegistrationStatus, string> = {
  registered: "Registered",
  withdrawn: "Withdrawn",
  disqualified: "Disqualified",
};

/*
 * IMPORTANT:
 * The event's actual format is events.format.
 * scoring_format is NOT used to decide whether an event is
 * individual and group formats.
 */
function getEventFormat(event: Event): EventFormat {
  return event.format;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/* ============================================================
   PAGE
============================================================ */

export default function RegistrationsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [chest, setChest] = useState("");
  const [student, setStudent] = useState<Student | null>(null);

  const [events, setEvents] = useState<Event[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(
    new Set()
  );

  const [individualDiscipline, setIndividualDiscipline] = useState("All");
  const [teamDiscipline, setTeamDiscipline] = useState("All");
  const [historyFilter, setHistoryFilter] = useState<
    "All" | "Registered" | "Withdrawn" | "Disqualified"
  >("All");

  const [loadingStudent, setLoadingStudent] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [showExcelImport, setShowExcelImport] = useState(false);
  const [importFileName, setImportFileName] = useState("");
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [importProcessing, setImportProcessing] = useState(false);
  const [importSaving, setImportSaving] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);


  /* ==========================================================
     EXCEL IMPORT
  ========================================================== */

  function resetExcelImport() {
    setImportFileName("");
    setImportRows([]);
    setImportSummary(null);
    setImportProcessing(false);
    setImportSaving(false);
    if (importInputRef.current) {
      importInputRef.current.value = "";
    }
  }

  async function processExcelFile(file: File) {
    setError("");
    setMessage("");
    setImportProcessing(true);
    setImportRows([]);
    setImportSummary(null);
    setImportFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });

      const validSheets = workbook.SheetNames.filter((sheet) =>
        ["ATLAS", "OLYMPUS", "TITAN"].includes(sheet.trim().toUpperCase())
      );

      if (validSheets.length === 0) {
        throw new Error(
          "No valid house sheets were found. Expected ATLAS, OLYMPUS and/or TITAN."
        );
      }

      const parsed: Array<{
        sheet: string;
        chestNo: number | null;
        admissionNo: string;
        name: string;
        className: string;
        eventName: string;
      }> = [];

      for (const sheetName of validSheets) {
        const sheet = workbook.Sheets[sheetName];
        const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
          header: 1,
          defval: null,
          raw: true,
        });

        const headerIndex = matrix.findIndex((row) =>
          row.some(
            (cell) => normalizeImportText(cell) === "chestno"
          )
        );

        if (headerIndex < 0) continue;

        const header = matrix[headerIndex] ?? [];
        const chestIndex = header.findIndex(
          (cell) => normalizeImportText(cell) === "chestno"
        );
        const admissionIndex = header.findIndex((cell) => {
          const n = normalizeImportText(cell);
          return n === "admno" || n === "admissionno";
        });
        const nameIndex = header.findIndex((cell) =>
          ["name", "nameofstudent", "studentname"].includes(
            normalizeImportText(cell)
          )
        );
        const classIndex = header.findIndex((cell) =>
          ["class", "classname"].includes(normalizeImportText(cell))
        );

        if (chestIndex < 0) continue;

        const eventColumns = header
          .map((cell, index) => ({
            name: String(cell ?? "").trim(),
            index,
          }))
          .filter(({ name, index }) => {
            if (!name) return false;
            return ![chestIndex, admissionIndex, nameIndex, classIndex].includes(index);
          });

        for (let rowIndex = headerIndex + 1; rowIndex < matrix.length; rowIndex++) {
          const row = matrix[rowIndex] ?? [];
          const rawChest = row[chestIndex];
          const chestNo = Number(rawChest);

          if (!Number.isInteger(chestNo) || chestNo <= 0) continue;

          const studentName = String(row[nameIndex] ?? "").trim();
          const admissionNo = String(row[admissionIndex] ?? "").trim();
          const className = String(row[classIndex] ?? "").trim();

          for (const column of eventColumns) {
            if (!isImportChecked(row[column.index])) continue;

            parsed.push({
              sheet: sheetName.toUpperCase(),
              chestNo,
              admissionNo,
              name: studentName,
              className,
              eventName: column.name,
            });
          }
        }
      }

      if (parsed.length === 0) {
        throw new Error(
          "No checked event registrations were found in the workbook."
        );
      }

      const chestNumbers = Array.from(
        new Set(parsed.map((row) => row.chestNo).filter(Boolean) as number[])
      );

      const { data: studentData, error: studentsError } = await supabase
        .from("students")
        .select("id,admission_no,chest_no,name,class_name,category")
        .in("chest_no", chestNumbers);

      if (studentsError) throw new Error(studentsError.message);

      const studentsByChest = new Map(
        (studentData ?? []).map((student: any) => [student.chest_no, student])
      );

      const { data: eventData, error: eventsError } = await supabase
        .from("events")
        .select("id,category,name,discipline,format,scoring_format")
        .eq("is_active", true);

      if (eventsError) throw new Error(eventsError.message);

      const eventsByCategory = new Map<string, Event[]>();
      for (const event of (eventData ?? []) as Event[]) {
        const key = normalizeImportText(event.category);
        const list = eventsByCategory.get(key) ?? [];
        list.push(event);
        eventsByCategory.set(key, list);
      }

      const studentIds = Array.from(
        new Set(
          (studentData ?? []).map((student: any) => student.id).filter(Boolean)
        )
      );

      const { data: existingData, error: existingError } =
        studentIds.length > 0
          ? await supabase
              .from("registrations")
              .select("student_id,event_id,status")
              .in("student_id", studentIds)
          : { data: [], error: null };

      if (existingError) throw new Error(existingError.message);

      const existingSet = new Set(
        (existingData ?? [])
          .filter((row: any) => row.status === "registered")
          .map((row: any) => `${row.student_id}:${row.event_id}`)
      );

      const resultRows: ImportRow[] = parsed.map((row) => {
        const matchedStudent = studentsByChest.get(row.chestNo as number);

        if (!matchedStudent) {
          return {
            ...row,
            studentId: null,
            eventId: null,
            studentFound: false,
            eventFound: false,
            alreadyRegistered: false,
            reason: "Student not found by Chest Number.",
          };
        }

        const categoryEvents =
          eventsByCategory.get(normalizeImportText(matchedStudent.category)) ?? [];

        const eventAliases = eventImportAliases(row.eventName);
        const matchedEvent = categoryEvents.find((event) => {
          const aliases = eventImportAliases(event.name);
          return Array.from(eventAliases).some((alias) => aliases.has(alias));
        });

        if (!matchedEvent) {
          return {
            ...row,
            studentId: matchedStudent.id,
            eventId: null,
            studentFound: true,
            eventFound: false,
            alreadyRegistered: false,
            reason: `Event not found for category ${matchedStudent.category}.`,
          };
        }

        const key = `${matchedStudent.id}:${matchedEvent.id}`;

        return {
          ...row,
          studentId: matchedStudent.id,
          eventId: matchedEvent.id,
          studentFound: true,
          eventFound: true,
          alreadyRegistered: existingSet.has(key),
        };
      });

      const uniqueRows = new Map<string, ImportRow>();
      for (const row of resultRows) {
        const key = row.studentId && row.eventId
          ? `${row.studentId}:${row.eventId}`
          : `${row.sheet}:${row.chestNo}:${row.eventName}`;

        if (!uniqueRows.has(key)) uniqueRows.set(key, row);
      }

      const finalRows = Array.from(uniqueRows.values());
      const matchedStudents = new Set(
        finalRows
          .filter((row) => row.studentFound && row.studentId)
          .map((row) => row.studentId as string)
      );

      const invalidRows = finalRows.filter(
        (row) => !row.studentFound || !row.eventFound
      );
      const validRows = finalRows.filter(
        (row) => row.studentFound && row.eventFound
      );
      const alreadyRegistered = validRows.filter(
        (row) => row.alreadyRegistered
      ).length;

      setImportRows(finalRows);
      setImportSummary({
        studentsProcessed: chestNumbers.length,
        studentsMatched: matchedStudents.size,
        studentsNotFound: chestNumbers.filter(
          (chestNo) => !studentsByChest.has(chestNo)
        ).length,
        registrationsFound: finalRows.length,
        newRegistrations: validRows.length - alreadyRegistered,
        alreadyRegistered,
        invalidRegistrations: invalidRows.length,
      });
    } catch (err) {
      console.error("EXCEL IMPORT PROCESSING ERROR:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to process the Excel file."
      );
    } finally {
      setImportProcessing(false);
    }
  }

  async function importExcelRegistrations() {
    const validRows = importRows.filter(
      (row) => row.studentFound && row.eventFound && row.studentId && row.eventId
    );

    if (validRows.length === 0) {
      setError("There are no valid registrations ready to import.");
      return;
    }

    setImportSaving(true);
    setError("");
    setMessage("");

    try {
      const rows = validRows.map((row) => ({
        student_id: row.studentId as string,
        event_id: row.eventId as string,
        status: "registered",
        notes: `Imported from ${importFileName || "Excel registration file"}`,
      }));

      for (let index = 0; index < rows.length; index += 500) {
        const chunk = rows.slice(index, index + 500);
        const { error: importError } = await supabase
          .from("registrations")
          .upsert(chunk, {
            onConflict: "student_id,event_id",
          });

        if (importError) throw new Error(importError.message);
      }

      const newCount = validRows.filter((row) => !row.alreadyRegistered).length;
      const existingCount = validRows.length - newCount;

      setMessage(
        `${newCount} new registration${newCount === 1 ? "" : "s"} imported successfully${
          existingCount > 0
            ? `; ${existingCount} existing registration${existingCount === 1 ? "" : "s"} kept.`
            : "."
        }`
      );

      setShowExcelImport(false);
      resetExcelImport();
    } catch (err) {
      console.error("EXCEL REGISTRATION IMPORT ERROR:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to import registrations."
      );
    } finally {
      setImportSaving(false);
    }
  }

  /* ==========================================================
     LOAD EVENTS + REGISTRATIONS
  ========================================================== */

  async function loadEventsAndRegistrations(found: Student) {
    setLoadingEvents(true);
    setError("");

    try {
      // Only active, eligible events appear in registration selection.
      const [eventsResponse, registrationsResponse] =
        await Promise.all([
          supabase
            .from("events")
            .select(
              "id,category,name,discipline,format,scoring_format"
            )
            .eq("is_active", true)
            .eq("category", found.category)
            .order("discipline", { ascending: true })
            .order("name", { ascending: true }),

          supabase
            .from("registrations")
            .select(
              "id,event_id,status,registered_at,notes"
            )
            .eq("student_id", found.id)
            .order("registered_at", { ascending: false }),
        ]);

      if (eventsResponse.error) {
        throw new Error(eventsResponse.error.message);
      }

      if (registrationsResponse.error) {
        throw new Error(registrationsResponse.error.message);
      }

      const eligibleEvents = (eventsResponse.data ?? []) as Event[];

      const eventMap = new Map(
        eligibleEvents.map((event) => [event.id, event])
      );

      const history: Registration[] = (registrationsResponse.data ?? [])
        .map((row: any) => {
          const event = eventMap.get(row.event_id);

          /*
           * Only display registration history for events currently
           * belonging to this student's category.
           */
          if (!event) return null;

          return {
            id: row.id,
            event_id: row.event_id,
            status: row.status as RegistrationStatus,
            registered_at: row.registered_at,
            notes: row.notes ?? null,
            event,
          };
        })
        .filter(Boolean) as Registration[];

      setEvents(eligibleEvents);
      setRegistrations(history);

      /*
       * This is the key behaviour:
       * BOTH individual and group registrations are selected
       * from the same registrations table.
       */
      setSelectedEvents(
        new Set(
          history
            .filter((registration) => registration.status === "registered")
            .map((registration) => registration.event_id)
        )
      );
    } catch (err) {
      console.error("REGISTRATION DATA LOAD ERROR:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load registration data."
      );
    } finally {
      setLoadingEvents(false);
    }
  }

  /* ==========================================================
     STUDENT LOOKUP
  ========================================================== */

  async function lookupStudent() {
    setError("");
    setMessage("");

    const chestNumber = Number(chest.trim());

    if (!Number.isInteger(chestNumber) || chestNumber <= 0) {
      setError("Enter a valid positive Chest Number.");
      return;
    }

    setLoadingStudent(true);
    setStudent(null);
    setEvents([]);
    setRegistrations([]);
    setSelectedEvents(new Set());

    try {
      const { data, error: studentError } = await supabase
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
            houses(name)
          `
        )
        .eq("chest_no", chestNumber)
        .maybeSingle();

      if (studentError) {
        throw new Error(studentError.message);
      }

      if (!data) {
        throw new Error(
          `No student was found with Chest Number ${chestNumber}.`
        );
      }

      const houseData = Array.isArray((data as any).houses)
        ? (data as any).houses[0]
        : (data as any).houses;

      const found: Student = {
        id: data.id,
        admission_no: data.admission_no,
        chest_no: data.chest_no,
        name: data.name,
        class_name: data.class_name,
        division: data.division,
        category: data.category,
        gender: data.gender,
        house: houseData?.name ?? "Unassigned",
      };

      setStudent(found);
      await loadEventsAndRegistrations(found);
    } catch (err) {
      console.error("STUDENT LOOKUP ERROR:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to find the student."
      );
    } finally {
      setLoadingStudent(false);
    }
  }

  /* ==========================================================
     DERIVED DATA
  ========================================================== */

  const individualEvents = useMemo(
    () =>
      events.filter(
        (event) => getEventFormat(event) === "individual"
      ),
    [events]
  );

  const teamEvents = useMemo(
    () =>
      events.filter((event) => {
        const format = getEventFormat(event);
        return format === "team" || format === "relay";
      }),
    [events]
  );

  const individualDisciplines = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(
          individualEvents
            .map((event) => event.discipline)
            .filter(Boolean)
        )
      ),
    ],
    [individualEvents]
  );

  const teamDisciplines = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(
          teamEvents
            .map((event) => event.discipline)
            .filter(Boolean)
        )
      ),
    ],
    [teamEvents]
  );

  const filteredIndividualEvents = useMemo(
    () =>
      individualEvents.filter(
        (event) =>
          individualDiscipline === "All" ||
          event.discipline === individualDiscipline
      ),
    [individualEvents, individualDiscipline]
  );

  const filteredTeamEvents = useMemo(
    () =>
      teamEvents.filter(
        (event) =>
          teamDiscipline === "All" ||
          event.discipline === teamDiscipline
      ),
    [teamEvents, teamDiscipline]
  );

  const groupedIndividualEvents = useMemo(
    () =>
      filteredIndividualEvents.reduce<Record<string, Event[]>>(
        (groups, event) => {
          if (!groups[event.discipline]) {
            groups[event.discipline] = [];
          }

          groups[event.discipline].push(event);
          return groups;
        },
        {}
      ),
    [filteredIndividualEvents]
  );

  const groupedTeamEvents = useMemo(
    () =>
      filteredTeamEvents.reduce<Record<string, Event[]>>(
        (groups, event) => {
          if (!groups[event.discipline]) {
            groups[event.discipline] = [];
          }

          groups[event.discipline].push(event);
          return groups;
        },
        {}
      ),
    [filteredTeamEvents]
  );

  const registeredEventIds = useMemo(
    () =>
      new Set(
        registrations
          .filter(
            (registration) => registration.status === "registered"
          )
          .map((registration) => registration.event_id)
      ),
    [registrations]
  );

  const registeredCount = registeredEventIds.size;

  const selectedIndividualCount = individualEvents.filter((event) =>
    selectedEvents.has(event.id)
  ).length;

  const selectedTeamCount = teamEvents.filter((event) =>
    selectedEvents.has(event.id)
  ).length;

  const eventsToRegister = useMemo(
    () =>
      [...selectedEvents].filter(
        (eventId) => !registeredEventIds.has(eventId)
      ),
    [selectedEvents, registeredEventIds]
  );

  const eventsToWithdraw = useMemo(
    () =>
      [...registeredEventIds].filter(
        (eventId) => !selectedEvents.has(eventId)
      ),
    [selectedEvents, registeredEventIds]
  );

  const hasChanges =
    eventsToRegister.length > 0 || eventsToWithdraw.length > 0;

  const filteredHistory = useMemo(
    () =>
      registrations.filter((registration) => {
        if (historyFilter === "All") return true;

        return (
          registration.status ===
          historyFilter.toLowerCase()
        );
      }),
    [registrations, historyFilter]
  );

  /* ==========================================================
     EVENT TOGGLE
  ========================================================== */

  function toggleEvent(eventId: string) {
    setSelectedEvents((previous) => {
      const next = new Set(previous);

      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }

      return next;
    });

    setError("");
    setMessage("");
  }

  /* ==========================================================
     SAVE REGISTRATIONS
  ========================================================== */

  async function saveRegistrations() {
    if (!student) {
      setError("Look up a student first.");
      return;
    }

    if (!hasChanges) {
      setMessage("There are no registration changes to save.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      /*
       * This applies to ALL formats:
       * individual and group events.
       *
       * Group-event registration means that the student is eligible
       * to be selected later in Group Rosters.
       */
      if (eventsToRegister.length > 0) {
        const rows = eventsToRegister.map((eventId) => ({
          student_id: student.id,
          event_id: eventId,
          status: "registered",
          notes: null,
        }));

        const { error: registerError } = await supabase
          .from("registrations")
          .upsert(rows, {
            onConflict: "student_id,event_id",
          });

        if (registerError) {
          throw new Error(registerError.message);
        }
      }

      /*
       * Removed selections are withdrawn rather than deleted,
       * preserving registration history.
       */
      if (eventsToWithdraw.length > 0) {
        const { error: withdrawError } = await supabase
          .from("registrations")
          .update({ status: "withdrawn" })
          .eq("student_id", student.id)
          .in("event_id", eventsToWithdraw)
          .eq("status", "registered");

        if (withdrawError) {
          throw new Error(withdrawError.message);
        }
      }

      await loadEventsAndRegistrations(student);

      setMessage(
        `${eventsToRegister.length + eventsToWithdraw.length} registration change${
          eventsToRegister.length + eventsToWithdraw.length === 1
            ? ""
            : "s"
        } saved successfully.`
      );
    } catch (err) {
      console.error("REGISTRATION SAVE ERROR:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Could not save registrations."
      );
    } finally {
      setSaving(false);
    }
  }

  /* ==========================================================
     WITHDRAW SINGLE
  ========================================================== */

  async function withdrawRegistration(
    registration: Registration
  ) {
    if (
      !student ||
      registration.status !== "registered"
    ) {
      return;
    }

    const confirmed = window.confirm(
      `Withdraw ${student.name} from "${registration.event.name}"?`
    );

    if (!confirmed) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const { error: withdrawError } = await supabase
        .from("registrations")
        .update({ status: "withdrawn" })
        .eq("id", registration.id);

      if (withdrawError) {
        throw new Error(withdrawError.message);
      }

      await loadEventsAndRegistrations(student);

      setMessage(
        `"${registration.event.name}" registration withdrawn.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to withdraw registration."
      );
    } finally {
      setSaving(false);
    }
  }

  /* ==========================================================
     RESTORE
  ========================================================== */

  async function restoreRegistration(
    registration: Registration
  ) {
    if (!student) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const { error: restoreError } = await supabase
        .from("registrations")
        .update({ status: "registered" })
        .eq("id", registration.id);

      if (restoreError) {
        throw new Error(restoreError.message);
      }

      await loadEventsAndRegistrations(student);

      setMessage(
        `"${registration.event.name}" registration restored.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to restore registration."
      );
    } finally {
      setSaving(false);
    }
  }

  /* ==========================================================
     RESET
  ========================================================== */

  function resetLookup() {
    setChest("");
    setStudent(null);
    setEvents([]);
    setRegistrations([]);
    setSelectedEvents(new Set());
    setIndividualDiscipline("All");
    setTeamDiscipline("All");
    setHistoryFilter("All");
    setError("");
    setMessage("");
  }

  /* ==========================================================
     EVENT CARD
  ========================================================== */

  function renderEventCard(event: Event) {
    const format = getEventFormat(event);
    const selected = selectedEvents.has(event.id);
    const registered = registeredEventIds.has(event.id);

    const formatClass =
      format === "individual"
        ? "individual"
        : format === "relay"
        ? "relay"
        : "team";

    return (
      <button
        key={event.id}
        type="button"
        onClick={() => toggleEvent(event.id)}
        aria-pressed={selected}
        className={`eventCard ${formatClass} ${
          selected ? "selected" : ""
        }`}
      >
        <div className="eventCardTop">
          <div className="eventIcon">
            {format === "individual" ? (
              <UserRound size={18} />
            ) : (
              <Users size={18} />
            )}
          </div>

          <span className={`eventCheck ${selected ? "checked" : ""}`}>
            {selected ? <Check size={15} /> : "+"}
          </span>
        </div>

        <div className="eventCardBody">
          <h4>{event.name}</h4>
          <p>{event.discipline}</p>
        </div>

        <div className="eventCardBottom">
          <span className="formatBadge">
            {FORMAT_LABEL[format]}
          </span>

          {registered && (
            <span className="registeredBadge">
              Registered
            </span>
          )}
        </div>
      </button>
    );
  }

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <main className="registrationPage">
      <div className="registrationContainer">
        {/* HEADER */}
        <header className="pageHeader">
          <div className="headerMain">
            <Link href="/admin" className="backLink">
              <ArrowLeft size={16} />
              Dashboard
            </Link>

            <div className="eyebrow">
              <Trophy size={13} />
              SARGAMIYA 2026 / COMPETITIONS
            </div>

            <h1>Event Registration</h1>

            <p>
              Register students for individual and group events. Group composition is completed separately in Group Rosters.
            </p>
          </div>

          <div className="headerActions">
            <a
              href="/templates/Website%20Entry%20Form.xlsx"
              download="Sargamiya_2026_Registration_Template.xlsx"
              className="secondaryButton registrationTemplateButton"
              aria-label="Download Registration Excel Template"
            >
              <FileSpreadsheet size={16} />
              Registration Template
            </a>

            <button
              type="button"
              className="secondaryButton importExcelButton"
              onClick={() => {
                setShowExcelImport(true);
                setError("");
                setMessage("");
              }}
            >
              <FileSpreadsheet size={16} />
              Import Excel
            </button>

            <Link href="/admin/teams" className="secondaryButton">
              <Users size={16} />
              Group Rosters
            </Link>

            <Link href="/admin/results" className="secondaryButton">
              <ClipboardList size={16} />
              Results
            </Link>
          </div>
        </header>

        {/* ALERTS */}
        {error && (
          <div className="alert errorAlert">
            <AlertTriangle size={19} />
            <div>
              <strong>Registration error</strong>
              <p>{error}</p>
            </div>

            <button
              type="button"
              className="alertClose"
              onClick={() => setError("")}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {message && (
          <div className="alert successAlert">
            <CheckCircle2 size={19} />
            <div>
              <strong>Registration updated</strong>
              <p>{message}</p>
            </div>

            <button
              type="button"
              className="alertClose"
              onClick={() => setMessage("")}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* LOOKUP */}
        <section className="lookupCard">
          <div className="sectionHeader">
            <div>
              <div className="sectionEyebrow">
                STUDENT LOOKUP
              </div>

              <h2>Register by Chest Number</h2>

              <p>
                Enter a student's Chest Number to load their
                category, House and eligible events.
              </p>
            </div>
          </div>

          <div className="lookupRow">
            <div className="searchInputWrap">
              <Search size={18} />

              <input
                type="text"
                value={chest}
                onChange={(event) =>
                  setChest(
                    event.target.value.replace(/\D/g, "")
                  )
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void lookupStudent();
                  }
                }}
                placeholder="Enter Chest Number"
                inputMode="numeric"
                autoFocus
              />
            </div>

            <button
              type="button"
              className="primaryButton"
              onClick={() => void lookupStudent()}
              disabled={loadingStudent}
            >
              {loadingStudent ? (
                <>
                  <Loader2 size={17} className="spin" />
                  Searching…
                </>
              ) : (
                <>
                  <Search size={17} />
                  Find Student
                </>
              )}
            </button>

            {student && (
              <button
                type="button"
                className="clearButton"
                onClick={resetLookup}
              >
                <RotateCcw size={15} />
                Clear
              </button>
            )}
          </div>
        </section>

        {/* STUDENT */}
        {student && (
          <>
            <section className="studentCard">
              <div className="studentIdentity">
                <div className="studentAvatar">
                  <UserRound size={24} />
                </div>

                <div className="studentText">
                  <div className="chestLabel">
                    CHEST {student.chest_no}
                  </div>

                  <h2>{student.name}</h2>

                  <p>
                    Admission {student.admission_no}
                    {" · "}
                    {student.class_name}
                    {student.division
                      ? ` · ${student.division}`
                      : ""}
                  </p>

                  <div className="studentMeta">
                    <span>
                      <strong>Category</strong>
                      {student.category}
                    </span>

                    <span>
                      <strong>House</strong>
                      {student.house}
                    </span>

                    {student.gender && (
                      <span>
                        <strong>Gender</strong>
                        {student.gender}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="statGrid">
                <div className="stat">
                  <strong>{registeredCount}</strong>
                  <span>Registered</span>
                </div>

                <div className="stat individualStat">
                  <strong>{selectedIndividualCount}</strong>
                  <span>Individual</span>
                </div>

                <div className="stat teamStat">
                  <strong>{selectedTeamCount}</strong>
                  <span>Group Event</span>
                </div>
              </div>
            </section>

            {/* ==================================================
                SECTION 01 — INDIVIDUAL EVENTS
            ================================================== */}
            <section className="eventSection individualSection">
              <div className="eventSectionHeader">
                <div>
                  <div className="sectionEyebrow blue">
                    SECTION 01 · INDIVIDUAL EVENTS
                  </div>

                  <h2>Individual Event Registration</h2>

                  <p>
                    Select individual and group arts events
                    for this student.
                  </p>
                </div>

                <select
                  value={individualDiscipline}
                  onChange={(event) =>
                    setIndividualDiscipline(event.target.value)
                  }
                >
                  {individualDisciplines.map((discipline) => (
                    <option
                      key={discipline}
                      value={discipline}
                    >
                      {discipline === "All"
                        ? "All Disciplines"
                        : discipline}
                    </option>
                  ))}
                </select>
              </div>

              <div className="eventSectionBody">
                {loadingEvents ? (
                  <div className="loadingBox">
                    <Loader2 size={28} className="spin" />
                    <span>Loading events…</span>
                  </div>
                ) : individualEvents.length === 0 ? (
                  <div className="emptyBox">
                    <UserRound size={27} />
                    <strong>
                      No individual events configured
                    </strong>
                    <span>
                      There are no individual events for{" "}
                      {student.category}.
                    </span>
                  </div>
                ) : Object.keys(groupedIndividualEvents).length ===
                  0 ? (
                  <div className="emptyBox compact">
                    <span>
                      No individual events match this discipline.
                    </span>
                  </div>
                ) : (
                  <div className="disciplineGroups">
                    {Object.entries(groupedIndividualEvents).map(
                      ([discipline, disciplineEvents]) => (
                        <div
                          className="disciplineGroup"
                          key={discipline}
                        >
                          <div className="disciplineHeader">
                            <div>
                              <h3>{discipline}</h3>
                              <span>
                                {disciplineEvents.length} event
                                {disciplineEvents.length === 1
                                  ? ""
                                  : "s"}
                              </span>
                            </div>
                          </div>

                          <div className="eventGrid">
                            {disciplineEvents.map(
                              renderEventCard
                            )}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* ==================================================
                SECTION 02 — GROUP EVENTS
            ================================================== */}
            <section className="eventSection teamSection">
              <div className="eventSectionHeader">
                <div>
                  <div className="sectionEyebrow violet">
                    SECTION 02 · GROUP EVENTS
                  </div>

                  <h2>Group Event Registration</h2>

                  <p>
                    Register this student for the selected group events. Registered students
                    become available in Group Rosters for
                    official roster creation.
                  </p>
                </div>

                <select
                  value={teamDiscipline}
                  onChange={(event) =>
                    setTeamDiscipline(event.target.value)
                  }
                >
                  {teamDisciplines.map((discipline) => (
                    <option
                      key={discipline}
                      value={discipline}
                    >
                      {discipline === "All"
                        ? "All Group Disciplines"
                        : discipline}
                    </option>
                  ))}
                </select>
              </div>

              <div className="teamInfo">
                <div className="teamInfoIcon">
                  <Users size={18} />
                </div>

                <div>
                  <strong>
                    Registration comes before roster creation.
                  </strong>

                  <p>
                    Select the events below and save. After that,
                    open <strong>Group Rosters</strong> to
                    choose registered students from the same House
                    and build the official group roster.
                  </p>
                </div>

                <Link href="/admin/teams" className="teamInfoButton">
                  <Users size={15} />
                  Open Group Rosters
                </Link>
              </div>

              <div className="eventSectionBody">
                {loadingEvents ? (
                  <div className="loadingBox">
                    <Loader2 size={28} className="spin" />
                    <span>Loading group events…</span>
                  </div>
                ) : teamEvents.length === 0 ? (
                  <div className="emptyBox teamEmpty">
                    <Users size={27} />
                    <strong>
                      No group events configured
                    </strong>
                    <span>
                      There are no group events for{" "}
                      {student.category}.
                    </span>
                  </div>
                ) : Object.keys(groupedTeamEvents).length === 0 ? (
                  <div className="emptyBox compact">
                    <span>
                      No group events match this discipline.
                    </span>
                  </div>
                ) : (
                  <div className="disciplineGroups">
                    {Object.entries(groupedTeamEvents).map(
                      ([discipline, disciplineEvents]) => (
                        <div
                          className="disciplineGroup"
                          key={discipline}
                        >
                          <div className="disciplineHeader">
                            <div>
                              <h3>{discipline}</h3>
                              <span>
                                {disciplineEvents.length} event
                                {disciplineEvents.length === 1
                                  ? ""
                                  : "s"}
                              </span>
                            </div>
                          </div>

                          <div className="eventGrid">
                            {disciplineEvents.map(
                              renderEventCard
                            )}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* SAVE BAR */}
            <section className="saveBar">
              <div className="saveSummary">
                <div className="saveCount">
                  <strong>{selectedEvents.size}</strong>
                  <span>
                    selected event
                    {selectedEvents.size === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="saveChanges">
                  {hasChanges ? (
                    <>
                      <b>{eventsToRegister.length}</b> to register
                      <span>·</span>
                      <b>{eventsToWithdraw.length}</b> to withdraw
                    </>
                  ) : (
                    "No unsaved changes"
                  )}
                </div>
              </div>

              <button
                type="button"
                className="primaryButton saveButton"
                onClick={() => void saveRegistrations()}
                disabled={
                  saving ||
                  loadingEvents ||
                  !hasChanges
                }
              >
                {saving ? (
                  <Loader2 size={17} className="spin" />
                ) : (
                  <CheckCircle2 size={17} />
                )}

                {saving
                  ? "Saving…"
                  : "Save All Registrations"}
              </button>
            </section>

            {/* HISTORY */}
            <section className="historySection">
              <div className="historyHeader">
                <div>
                  <div className="sectionEyebrow">
                    REGISTRATION HISTORY
                  </div>

                  <h2>Current &amp; Previous Registrations</h2>

                  <p>
                    Withdrawn registrations remain in the history
                    and can be restored.
                  </p>
                </div>

                <div className="historyFilters">
                  {(
                    [
                      "All",
                      "Registered",
                      "Withdrawn",
                      "Disqualified",
                    ] as const
                  ).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      className={
                        historyFilter === filter
                          ? "active"
                          : ""
                      }
                      onClick={() =>
                        setHistoryFilter(filter)
                      }
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              {filteredHistory.length === 0 ? (
                <div className="historyEmpty">
                  <ClipboardList size={28} />
                  <strong>No registration records found.</strong>
                  <span>
                    Selected events will appear here after saving.
                  </span>
                </div>
              ) : (
                <div className="historyTableWrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Event</th>
                        <th>Type</th>
                        <th>Discipline</th>
                        <th>Status</th>
                        <th>Registered</th>
                        <th />
                      </tr>
                    </thead>

                    <tbody>
                      {filteredHistory.map((registration) => {
                        const format = getEventFormat(
                          registration.event
                        );

                        return (
                          <tr key={registration.id}>
                            <td>
                              <strong>
                                {registration.event.name}
                              </strong>
                              <small>
                                {registration.event.category}
                              </small>
                            </td>

                            <td>
                              <span className="tableType">
                                {FORMAT_LABEL[format]}
                              </span>
                            </td>

                            <td>
                              {registration.event.discipline}
                            </td>

                            <td>
                              <span
                                className={`status ${
                                  registration.status
                                }`}
                              >
                                {
                                  STATUS_LABEL[
                                    registration.status
                                  ]
                                }
                              </span>
                            </td>

                            <td>
                              {formatDate(
                                registration.registered_at
                              )}
                            </td>

                            <td className="actionCell">
                              {registration.status ===
                              "registered" ? (
                                <button
                                  type="button"
                                  className="withdrawButton"
                                  disabled={saving}
                                  onClick={() =>
                                    void withdrawRegistration(
                                      registration
                                    )
                                  }
                                >
                                  <X size={13} />
                                  Withdraw
                                </button>
                              ) : registration.status ===
                                "withdrawn" ? (
                                <button
                                  type="button"
                                  className="restoreButton"
                                  disabled={saving}
                                  onClick={() =>
                                    void restoreRegistration(
                                      registration
                                    )
                                  }
                                >
                                  <RotateCcw size={13} />
                                  Restore
                                </button>
                              ) : (
                                <span className="dash">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* ======================================================
          EXCEL IMPORT MODAL
      ====================================================== */}
      {showExcelImport && (
        <div className="excelModalBackdrop" role="dialog" aria-modal="true">
          <div className="excelModal">
            <div className="excelModalHeader">
              <div>
                <div className="sectionEyebrow blue">
                  <FileSpreadsheet size={13} />
                  BULK REGISTRATION IMPORT
                </div>
                <h2>Import Event Registrations</h2>
                <p>
                  Upload the SARGAMIYA entry workbook. ATLAS, OLYMPUS and TITAN
                  sheets are merged into one registration list.
                </p>
              </div>
              <button
                type="button"
                className="alertClose"
                onClick={() => {
                  setShowExcelImport(false);
                  resetExcelImport();
                }}
                disabled={importProcessing || importSaving}
              >
                <X size={18} />
              </button>
            </div>

            <div className="excelModalBody">
              <input
                ref={importInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hiddenFileInput"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void processExcelFile(file);
                }}
              />

              {!importSummary && !importProcessing && (
                <button
                  type="button"
                  className="excelDropzone"
                  onClick={() => importInputRef.current?.click()}
                >
                  <span className="excelDropIcon">
                    <UploadCloud size={28} />
                  </span>
                  <strong>Choose Excel File</strong>
                  <span>
                    Select Entry Form 2.xlsx or another workbook with ATLAS,
                    OLYMPUS and TITAN sheets.
                  </span>
                  <small>Supported formats: .xlsx, .xls</small>
                  <small className="registrationImportMarkHint">
                    Mark each event cell with ✓ to register that student. Blank cells are ignored.
                  </small>
                </button>
              )}

              {importProcessing && (
                <div className="excelProcessing">
                  <Loader2 size={32} className="spin" />
                  <strong>Processing {importFileName}…</strong>
                  <span>
                    Matching Chest Numbers, categories and events against the
                    SARGAMIYA database.
                  </span>
                </div>
              )}

              {importSummary && !importProcessing && (
                <>
                  <div className="importFileBar">
                    <FileSpreadsheet size={17} />
                    <strong>{importFileName}</strong>
                    <button
                      type="button"
                      onClick={() => importInputRef.current?.click()}
                      disabled={importSaving}
                    >
                      Choose another file
                    </button>
                  </div>

                  <div className="importStatsGrid">
                    <div className="importStatCard">
                      <strong>{importSummary.studentsProcessed}</strong>
                      <span>Students processed</span>
                    </div>
                    <div className="importStatCard success">
                      <strong>{importSummary.studentsMatched}</strong>
                      <span>Students matched</span>
                    </div>
                    <div className="importStatCard warning">
                      <strong>{importSummary.studentsNotFound}</strong>
                      <span>Students not found</span>
                    </div>
                    <div className="importStatCard">
                      <strong>{importSummary.registrationsFound}</strong>
                      <span>Registrations found</span>
                    </div>
                    <div className="importStatCard success">
                      <strong>{importSummary.newRegistrations}</strong>
                      <span>New registrations</span>
                    </div>
                    <div className="importStatCard neutral">
                      <strong>{importSummary.alreadyRegistered}</strong>
                      <span>Already registered</span>
                    </div>
                  </div>

                  {importSummary.invalidRegistrations > 0 && (
                    <div className="importWarning">
                      <AlertTriangle size={17} />
                      <div>
                        <strong>
                          {importSummary.invalidRegistrations} registration
                          {importSummary.invalidRegistrations === 1 ? "" : "s"}
                          need attention
                        </strong>
                        <span>
                          These rows will not be imported until their student or
                          event can be matched.
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="importPreviewHeader">
                    <div>
                      <strong>Registration Preview</strong>
                      <span>
                        {importSummary.newRegistrations} new registrations ready
                        to import
                      </span>
                    </div>
                  </div>

                  <div className="importPreviewTableWrap">
                    <table className="importPreviewTable">
                      <thead>
                        <tr>
                          <th>House</th>
                          <th>Chest</th>
                          <th>Student</th>
                          <th>Event</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importRows.slice(0, 120).map((row, index) => (
                          <tr key={`${row.sheet}-${row.chestNo}-${row.eventName}-${index}`}>
                            <td>{row.sheet}</td>
                            <td><strong>{row.chestNo ?? "—"}</strong></td>
                            <td>{row.name || "Unknown"}</td>
                            <td>{row.eventName}</td>
                            <td>
                              {row.studentFound && row.eventFound ? (
                                <span className={row.alreadyRegistered ? "importStatus existing" : "importStatus ready"}>
                                  {row.alreadyRegistered ? "Already registered" : "Ready"}
                                </span>
                              ) : (
                                <span className="importStatus invalid">
                                  {row.reason || "Invalid"}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {importRows.length > 120 && (
                    <p className="previewLimitNote">
                      Showing the first 120 rows. All valid rows will be imported.
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="excelModalFooter">
              <button
                type="button"
                className="clearButton"
                onClick={() => {
                  setShowExcelImport(false);
                  resetExcelImport();
                }}
                disabled={importProcessing || importSaving}
              >
                Cancel
              </button>

              {importSummary && (
                <button
                  type="button"
                  className="primaryButton"
                  onClick={() => void importExcelRegistrations()}
                  disabled={
                    importSaving ||
                    importProcessing ||
                    importSummary.newRegistrations === 0
                  }
                >
                  {importSaving ? (
                    <>
                      <Loader2 size={17} className="spin" />
                      Importing…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={17} />
                      Import {importSummary.newRegistrations} Registration
                      {importSummary.newRegistrations === 1 ? "" : "s"}
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================
          SELF-CONTAINED UI
          This page does not depend on Tailwind being compiled.
      ====================================================== */}
      <style>{`
        .registrationPage {
          min-height: 100vh;
          background: #f6f8fb;
          color: #0b1f41;
        }

        .registrationContainer {
          width: min(1440px, calc(100% - 48px));
          margin: 0 auto;
          padding: 28px 0 60px;
        }

        .pageHeader {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 28px;
          margin-bottom: 26px;
        }

        .headerMain {
          min-width: 0;
        }

        .backLink {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 18px;
          color: #64748b;
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
        }

        .backLink:hover {
          color: #0b1f41;
        }

        .eyebrow,
        .sectionEyebrow {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #94a3b8;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        .sectionEyebrow.blue {
          color: #2563eb;
        }

        .sectionEyebrow.violet {
          color: #7c3aed;
        }

        .pageHeader h1 {
          margin: 7px 0 0;
          color: #0b1f41;
          font-size: clamp(32px, 4vw, 48px);
          line-height: 1.02;
          letter-spacing: -0.045em;
          font-weight: 900;
        }

        .pageHeader p {
          max-width: 760px;
          margin: 11px 0 0;
          color: #64748b;
          font-size: 14px;
          line-height: 1.7;
        }

        .headerActions {
          display: flex;
          flex-wrap: wrap;
          gap: 9px;
          padding-top: 39px;
        }

        .secondaryButton,
        .primaryButton,
        .clearButton {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 42px;
          border-radius: 11px;
          padding: 0 15px;
          font-size: 12px;
          font-weight: 800;
          text-decoration: none;
          cursor: pointer;
          transition: 0.18s ease;
          box-sizing: border-box;
        }

        .secondaryButton,
        .clearButton {
          border: 1px solid #dbe3ee;
          background: #fff;
          color: #475569;
        }

        .secondaryButton:hover,
        .clearButton:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
          color: #0b1f41;
        }

        .primaryButton {
          border: 1px solid #0b1f41;
          background: #0b1f41;
          color: #fff;
          box-shadow: 0 5px 16px rgba(11, 31, 65, 0.12);
        }

        .primaryButton:hover {
          background: #132d59;
          border-color: #132d59;
        }

        .primaryButton:disabled,
        .clearButton:disabled {
          opacity: 0.45;
          cursor: not-allowed;
          box-shadow: none;
        }

        .alert {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 14px;
          padding: 14px 16px;
          border-radius: 14px;
          border: 1px solid;
        }

        .alert strong {
          display: block;
          font-size: 12px;
          font-weight: 900;
        }

        .alert p {
          margin: 3px 0 0;
          font-size: 12px;
          line-height: 1.55;
          overflow-wrap: anywhere;
        }

        .errorAlert {
          background: #fef2f2;
          border-color: #fecaca;
          color: #b91c1c;
        }

        .successAlert {
          background: #ecfdf5;
          border-color: #a7f3d0;
          color: #047857;
        }

        .alertClose {
          margin-left: auto;
          border: 0;
          background: transparent;
          color: inherit;
          opacity: 0.65;
          cursor: pointer;
        }

        .lookupCard,
        .studentCard,
        .eventSection,
        .historySection {
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          background: #fff;
          box-shadow: 0 4px 18px rgba(15, 23, 42, 0.035);
        }

        .lookupCard {
          overflow: hidden;
        }

        .sectionHeader,
        .eventSectionHeader,
        .historyHeader {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          padding: 21px 24px;
          border-bottom: 1px solid #eef2f7;
        }

        .sectionHeader h2,
        .eventSectionHeader h2,
        .historyHeader h2 {
          margin: 4px 0 0;
          color: #0b1f41;
          font-size: 20px;
          line-height: 1.2;
          letter-spacing: -0.025em;
          font-weight: 900;
        }

        .sectionHeader p,
        .eventSectionHeader p,
        .historyHeader p {
          margin: 6px 0 0;
          color: #64748b;
          font-size: 12px;
          line-height: 1.6;
        }

        .lookupRow {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 18px 24px 22px;
        }

        .searchInputWrap {
          position: relative;
          flex: 1;
          min-width: 180px;
        }

        .searchInputWrap svg {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
        }

        .searchInputWrap input {
          width: 100%;
          height: 48px;
          box-sizing: border-box;
          border: 1px solid #dbe3ee;
          border-radius: 12px;
          background: #f8fafc;
          color: #0b1f41;
          padding: 0 15px 0 42px;
          outline: none;
          font-size: 14px;
          font-weight: 700;
        }

        .searchInputWrap input:focus {
          background: #fff;
          border-color: #0b1f41;
          box-shadow: 0 0 0 4px rgba(11, 31, 65, 0.06);
        }

        .studentCard {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          margin-top: 16px;
          padding: 20px 22px;
        }

        .studentIdentity {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          min-width: 0;
        }

        .studentAvatar {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          flex: 0 0 48px;
          border-radius: 14px;
          background: #edf2f8;
          color: #0b1f41;
        }

        .studentText {
          min-width: 0;
        }

        .chestLabel {
          color: #64748b;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .studentText h2 {
          margin: 3px 0 0;
          color: #0b1f41;
          font-size: 23px;
          line-height: 1.1;
          font-weight: 900;
          letter-spacing: -0.03em;
        }

        .studentText > p {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 12px;
        }

        .studentMeta {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 11px;
        }

        .studentMeta span {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 5px 8px;
          color: #475569;
          background: #f8fafc;
          font-size: 10px;
          font-weight: 700;
        }

        .studentMeta strong {
          color: #94a3b8;
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .statGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(86px, 1fr));
          gap: 7px;
          flex: 0 0 360px;
        }

        .stat {
          border-radius: 11px;
          padding: 10px 8px;
          background: #f8fafc;
          text-align: center;
        }

        .stat.individualStat {
          background: #eff6ff;
        }

        .stat.teamStat {
          background: #f5f3ff;
        }

        .stat strong {
          display: block;
          color: #0b1f41;
          font-size: 20px;
          font-weight: 900;
        }

        .stat.individualStat strong {
          color: #2563eb;
        }

        .stat.teamStat strong {
          color: #7c3aed;
        }

        .stat span {
          display: block;
          margin-top: 2px;
          color: #94a3b8;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .eventSection {
          overflow: hidden;
          margin-top: 16px;
        }

        .individualSection {
          border-color: #e2e8f0;
        }

        .teamSection {
          border-color: #ddd6fe;
        }

        .teamSection .eventSectionHeader {
          background: linear-gradient(
            to right,
            #faf8ff,
            #fff
          );
          border-bottom-color: #ede9fe;
        }

        .eventSectionHeader select {
          height: 40px;
          min-width: 170px;
          border: 1px solid #dbe3ee;
          border-radius: 10px;
          background: #fff;
          color: #475569;
          padding: 0 11px;
          outline: none;
          font-size: 11px;
          font-weight: 800;
        }

        .teamSection .eventSectionHeader select {
          border-color: #ddd6fe;
        }

        .eventSectionBody {
          padding: 21px 24px;
        }

        .disciplineGroups {
          display: flex;
          flex-direction: column;
          gap: 25px;
        }

        .disciplineHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }

        .disciplineHeader h3 {
          margin: 0;
          color: #0b1f41;
          font-size: 13px;
          font-weight: 900;
        }

        .disciplineHeader span {
          display: block;
          margin-top: 2px;
          color: #94a3b8;
          font-size: 10px;
        }

        .eventGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }

        .eventCard {
          min-height: 154px;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          background: #fff;
          padding: 13px;
          text-align: left;
          color: #0b1f41;
          cursor: pointer;
          transition: 0.16s ease;
        }

        .eventCard:hover {
          transform: translateY(-2px);
          border-color: #cbd5e1;
          box-shadow: 0 8px 22px rgba(15, 23, 42, 0.07);
        }

        .eventCard.selected {
          border-width: 2px;
          padding: 12px;
        }

        .eventCard.individual.selected {
          border-color: #2563eb;
          background: #f7fbff;
        }

        .eventCard.relay.selected {
          border-color: #059669;
          background: #f4fffb;
        }

        .eventCard.team.selected {
          border-color: #7c3aed;
          background: #faf8ff;
        }

        .eventCardTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .eventIcon,
        .eventCheck {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          border-radius: 10px;
        }

        .eventIcon {
          background: #f1f5f9;
          color: #475569;
        }

        .eventCard.individual .eventIcon {
          background: #eff6ff;
          color: #2563eb;
        }

        .eventCard.relay .eventIcon {
          background: #ecfdf5;
          color: #059669;
        }

        .eventCard.team .eventIcon {
          background: #f5f3ff;
          color: #7c3aed;
        }

        .eventCheck {
          background: #f1f5f9;
          color: #94a3b8;
          font-size: 18px;
          font-weight: 900;
        }

        .eventCheck.checked {
          background: #0b1f41;
          color: #fff;
        }

        .eventCardBody {
          margin-top: 17px;
        }

        .eventCardBody h4 {
          margin: 0;
          color: #0b1f41;
          font-size: 13px;
          line-height: 1.3;
          font-weight: 900;
        }

        .eventCardBody p {
          margin: 4px 0 0;
          color: #94a3b8;
          font-size: 10px;
          line-height: 1.4;
        }

        .eventCardBottom {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 5px;
          margin-top: 16px;
        }

        .formatBadge,
        .registeredBadge {
          border-radius: 6px;
          padding: 4px 6px;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .formatBadge {
          border: 1px solid #e2e8f0;
          color: #64748b;
          background: #f8fafc;
        }

        .eventCard.individual .formatBadge {
          border-color: #bfdbfe;
          color: #2563eb;
          background: #eff6ff;
        }

        .eventCard.relay .formatBadge {
          border-color: #a7f3d0;
          color: #047857;
          background: #ecfdf5;
        }

        .eventCard.team .formatBadge {
          border-color: #ddd6fe;
          color: #7c3aed;
          background: #f5f3ff;
        }

        .registeredBadge {
          color: #047857;
          background: #ecfdf5;
        }

        .teamInfo {
          display: flex;
          align-items: center;
          gap: 11px;
          margin: 17px 24px 0;
          padding: 13px 14px;
          border: 1px solid #ddd6fe;
          border-radius: 12px;
          background: #faf8ff;
        }

        .teamInfoIcon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 35px;
          height: 35px;
          flex: 0 0 35px;
          border-radius: 10px;
          background: #ede9fe;
          color: #7c3aed;
        }

        .teamInfo strong {
          display: block;
          color: #4c1d95;
          font-size: 11px;
          font-weight: 900;
        }

        .teamInfo p {
          margin: 2px 0 0;
          color: #6d5a91;
          font-size: 10px;
          line-height: 1.55;
        }

        .teamInfoButton {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          margin-left: auto;
          min-height: 37px;
          flex: 0 0 auto;
          border-radius: 9px;
          padding: 0 12px;
          background: #0b1f41;
          color: #fff;
          font-size: 10px;
          font-weight: 800;
          text-decoration: none;
        }

        .teamInfoButton:hover {
          background: #132d59;
        }

        .loadingBox,
        .emptyBox {
          min-height: 170px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 7px;
          border: 1px dashed #dbe3ee;
          border-radius: 13px;
          background: #f8fafc;
          color: #94a3b8;
          text-align: center;
        }

        .loadingBox span,
        .emptyBox span {
          font-size: 11px;
        }

        .emptyBox strong {
          color: #475569;
          font-size: 12px;
        }

        .emptyBox svg {
          color: #cbd5e1;
        }

        .teamEmpty {
          border-color: #ddd6fe;
          background: #faf8ff;
        }

        .emptyBox.compact {
          min-height: 100px;
        }

        .saveBar {
          position: sticky;
          bottom: 14px;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-top: 16px;
          padding: 12px 15px 12px 17px;
          border: 1px solid #dbe3ee;
          border-radius: 15px;
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 12px 35px rgba(15, 23, 42, 0.12);
          backdrop-filter: blur(12px);
        }

        .saveCount {
          display: flex;
          align-items: baseline;
          gap: 5px;
        }

        .saveCount strong {
          color: #0b1f41;
          font-size: 19px;
          font-weight: 900;
        }

        .saveCount span {
          color: #475569;
          font-size: 12px;
          font-weight: 700;
        }

        .saveChanges {
          margin-top: 2px;
          color: #94a3b8;
          font-size: 10px;
        }

        .saveChanges b {
          color: #0b1f41;
        }

        .saveChanges span {
          margin: 0 5px;
        }

        .saveButton {
          min-width: 205px;
        }

        .historySection {
          overflow: hidden;
          margin-top: 16px;
        }

        .historyHeader {
          align-items: center;
        }

        .historyFilters {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
        }

        .historyFilters button {
          border: 0;
          border-radius: 8px;
          padding: 8px 10px;
          background: #f1f5f9;
          color: #64748b;
          font-size: 9px;
          font-weight: 900;
          cursor: pointer;
        }

        .historyFilters button.active {
          background: #0b1f41;
          color: #fff;
        }

        .historyTableWrap {
          width: 100%;
          overflow-x: auto;
        }

        .historyTableWrap table {
          width: 100%;
          min-width: 820px;
          border-collapse: collapse;
          text-align: left;
        }

        .historyTableWrap th {
          padding: 10px 14px;
          border-bottom: 1px solid #eef2f7;
          background: #f8fafc;
          color: #94a3b8;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .historyTableWrap td {
          padding: 13px 14px;
          border-bottom: 1px solid #f1f5f9;
          color: #64748b;
          font-size: 11px;
        }

        .historyTableWrap tbody tr:hover {
          background: #fafcff;
        }

        .historyTableWrap td strong {
          display: block;
          color: #0b1f41;
          font-size: 11px;
          font-weight: 900;
        }

        .historyTableWrap td small {
          display: block;
          margin-top: 3px;
          color: #94a3b8;
          font-size: 9px;
        }

        .tableType {
          display: inline-block;
          border-radius: 6px;
          padding: 4px 6px;
          background: #f1f5f9;
          color: #64748b;
          font-size: 8px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .status {
          display: inline-block;
          border-radius: 999px;
          padding: 5px 8px;
          font-size: 8px;
          font-weight: 900;
        }

        .status.registered {
          background: #ecfdf5;
          color: #047857;
        }

        .status.withdrawn {
          background: #fffbeb;
          color: #b45309;
        }

        .status.disqualified {
          background: #fef2f2;
          color: #b91c1c;
        }

        .actionCell {
          text-align: right;
          white-space: nowrap;
        }

        .withdrawButton,
        .restoreButton {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          border: 1px solid;
          border-radius: 8px;
          padding: 6px 8px;
          background: #fff;
          font-size: 9px;
          font-weight: 800;
          cursor: pointer;
        }

        .withdrawButton {
          border-color: #fde68a;
          color: #b45309;
        }

        .withdrawButton:hover {
          background: #fffbeb;
        }

        .restoreButton {
          border-color: #a7f3d0;
          color: #047857;
        }

        .restoreButton:hover {
          background: #ecfdf5;
        }

        .withdrawButton:disabled,
        .restoreButton:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .dash {
          color: #cbd5e1;
        }

        .historyEmpty {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 6px;
          min-height: 150px;
          color: #94a3b8;
          text-align: center;
        }

        .historyEmpty strong {
          color: #475569;
          font-size: 12px;
        }

        .historyEmpty span {
          font-size: 10px;
        }

        .spin {
          animation: spin 0.9s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }


        .importExcelButton {
          border-color: #cbd5e1;
        }

        .excelModalBackdrop {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: rgba(11, 31, 65, 0.42);
          backdrop-filter: blur(7px);
        }

        .excelModal {
          width: min(1120px, 100%);
          max-height: min(900px, calc(100vh - 48px));
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border: 1px solid #dbe3ee;
          border-radius: 20px;
          background: #fff;
          box-shadow: 0 28px 80px rgba(15, 23, 42, 0.24);
        }

        .excelModalHeader {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          padding: 22px 25px;
          border-bottom: 1px solid #eef2f7;
        }

        .excelModalHeader h2 {
          margin: 5px 0 0;
          color: #0b1f41;
          font-size: 23px;
          font-weight: 900;
          letter-spacing: -0.03em;
        }

        .excelModalHeader p {
          max-width: 720px;
          margin: 6px 0 0;
          color: #64748b;
          font-size: 11px;
          line-height: 1.6;
        }

        .excelModalBody {
          min-height: 0;
          overflow: auto;
          padding: 22px 25px;
        }

        .excelModalFooter {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 9px;
          padding: 14px 25px;
          border-top: 1px solid #eef2f7;
          background: #fbfcfe;
        }

        .hiddenFileInput {
          display: none;
        }

        .excelDropzone {
          width: 100%;
          min-height: 270px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 8px;
          border: 2px dashed #cbd5e1;
          border-radius: 16px;
          background: #f8fafc;
          color: #64748b;
          cursor: pointer;
          transition: 0.18s ease;
        }

        .excelDropzone:hover {
          border-color: #2563eb;
          background: #f7fbff;
        }

        .excelDropIcon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 58px;
          height: 58px;
          margin-bottom: 5px;
          border-radius: 16px;
          background: #eff6ff;
          color: #2563eb;
        }

        .excelDropzone strong {
          color: #0b1f41;
          font-size: 14px;
          font-weight: 900;
        }

        .excelDropzone span:not(.excelDropIcon) {
          max-width: 560px;
          text-align: center;
          font-size: 11px;
          line-height: 1.55;
        }

        .excelDropzone small {
          margin-top: 5px;
          color: #94a3b8;
          font-size: 9px;
          font-weight: 800;
        }

        .excelDropzone .registrationImportMarkHint {
          max-width: 560px;
          margin-top: 8px;
          color: #334155;
          font-size: 11px;
          font-weight: 700;
          line-height: 1.5;
          text-align: center;
        }

        .excelProcessing {
          min-height: 270px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 9px;
          color: #2563eb;
          text-align: center;
        }

        .excelProcessing strong {
          color: #0b1f41;
          font-size: 14px;
        }

        .excelProcessing span {
          max-width: 540px;
          color: #64748b;
          font-size: 11px;
          line-height: 1.55;
        }

        .importFileBar {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-bottom: 14px;
          padding: 10px 12px;
          border: 1px solid #dbe3ee;
          border-radius: 10px;
          background: #f8fafc;
          color: #0b1f41;
          font-size: 11px;
        }

        .importFileBar svg {
          color: #2563eb;
        }

        .importFileBar button {
          margin-left: auto;
          border: 0;
          background: transparent;
          color: #2563eb;
          font-size: 10px;
          font-weight: 800;
          cursor: pointer;
        }

        .importStatsGrid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 14px;
        }

        .importStatCard {
          min-height: 72px;
          display: flex;
          justify-content: center;
          flex-direction: column;
          padding: 10px;
          border: 1px solid #e2e8f0;
          border-radius: 11px;
          background: #f8fafc;
        }

        .importStatCard strong {
          color: #0b1f41;
          font-size: 20px;
          line-height: 1;
          font-weight: 900;
        }

        .importStatCard span {
          margin-top: 5px;
          color: #64748b;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .importStatCard.success {
          border-color: #a7f3d0;
          background: #ecfdf5;
        }

        .importStatCard.success strong {
          color: #047857;
        }

        .importStatCard.warning {
          border-color: #fde68a;
          background: #fffbeb;
        }

        .importStatCard.warning strong {
          color: #b45309;
        }

        .importStatCard.neutral {
          background: #f1f5f9;
        }

        .importWarning {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 14px;
          padding: 11px 12px;
          border: 1px solid #fde68a;
          border-radius: 11px;
          background: #fffbeb;
          color: #b45309;
        }

        .importWarning strong,
        .importWarning span {
          display: block;
        }

        .importWarning strong {
          font-size: 10px;
          font-weight: 900;
        }

        .importWarning span {
          margin-top: 2px;
          color: #92400e;
          font-size: 9px;
          line-height: 1.5;
        }

        .importPreviewHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .importPreviewHeader strong,
        .importPreviewHeader span {
          display: block;
        }

        .importPreviewHeader strong {
          color: #0b1f41;
          font-size: 12px;
          font-weight: 900;
        }

        .importPreviewHeader span {
          margin-top: 2px;
          color: #94a3b8;
          font-size: 9px;
        }

        .importPreviewTableWrap {
          max-height: 340px;
          overflow: auto;
          border: 1px solid #e2e8f0;
          border-radius: 11px;
        }

        .importPreviewTable {
          width: 100%;
          min-width: 760px;
          border-collapse: collapse;
          text-align: left;
        }

        .importPreviewTable th {
          position: sticky;
          top: 0;
          z-index: 1;
          padding: 9px 11px;
          border-bottom: 1px solid #e2e8f0;
          background: #f8fafc;
          color: #94a3b8;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.07em;
          text-transform: uppercase;
        }

        .importPreviewTable td {
          padding: 9px 11px;
          border-bottom: 1px solid #f1f5f9;
          color: #64748b;
          font-size: 10px;
        }

        .importPreviewTable td strong {
          color: #0b1f41;
          font-weight: 900;
        }

        .importStatus {
          display: inline-block;
          max-width: 190px;
          border-radius: 999px;
          padding: 4px 7px;
          font-size: 7px;
          font-weight: 900;
          line-height: 1.25;
        }

        .importStatus.ready {
          background: #ecfdf5;
          color: #047857;
        }

        .importStatus.existing {
          background: #f1f5f9;
          color: #64748b;
        }

        .importStatus.invalid {
          background: #fef2f2;
          color: #b91c1c;
        }

        .previewLimitNote {
          margin: 7px 0 0;
          color: #94a3b8;
          font-size: 9px;
          text-align: right;
        }

        @media (max-width: 1100px) {
          .eventGrid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .studentCard {
            align-items: flex-start;
            flex-direction: column;
          }

          .statGrid {
            width: 100%;
            flex-basis: auto;
          }
        }

        @media (max-width: 820px) {
          .registrationContainer {
            width: min(100% - 28px, 720px);
            padding-top: 18px;
          }

          .pageHeader {
            flex-direction: column;
          }

          .headerActions {
            padding-top: 0;
          }

          .sectionHeader,
          .eventSectionHeader,
          .historyHeader {
            align-items: flex-start;
            flex-direction: column;
          }

          .lookupRow {
            flex-wrap: wrap;
          }

          .searchInputWrap {
            flex-basis: 100%;
          }

          .eventGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .teamInfo {
            align-items: flex-start;
            flex-wrap: wrap;
          }

          .teamInfoButton {
            margin-left: 46px;
          }

          .saveBar {
            align-items: stretch;
            flex-direction: column;
          }

          .saveButton {
            width: 100%;
          }
        }

        @media (max-width: 520px) {
          .registrationContainer {
            width: calc(100% - 20px);
          }

          .pageHeader h1 {
            font-size: 32px;
          }

          .headerActions {
            width: 100%;
          }

          .secondaryButton {
            flex: 1;
          }

          .lookupRow {
            padding: 15px;
          }

          .lookupRow .primaryButton,
          .lookupRow .clearButton {
            flex: 1;
          }

          .studentCard,
          .eventSectionBody {
            padding-left: 14px;
            padding-right: 14px;
          }

          .studentMeta {
            flex-direction: column;
            align-items: flex-start;
          }

          .statGrid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .eventGrid {
            grid-template-columns: 1fr;
          }

          .eventCard {
            min-height: 135px;
          }

          .eventSectionHeader,
          .historyHeader {
            padding: 17px 14px;
          }

          .eventSectionHeader select {
            width: 100%;
          }

          .teamInfo {
            margin-left: 14px;
            margin-right: 14px;
          }

          .teamInfoButton {
            width: calc(100% - 46px);
            margin-left: 46px;
          }

          .historyFilters {
            width: 100%;
          }

          .historyFilters button {
            flex: 1;
          }
        }

        /* ======================================================
           UI PATCH — REGISTRATION WORKSPACE V2
           Plain CSS intentionally used here; no Tailwind required.
        ====================================================== */
        .registrationPage {
          background:
            radial-gradient(circle at 100% 0%, rgba(37, 99, 235, 0.035), transparent 32%),
            #f4f7fb;
        }

        .registrationContainer {
          width: min(1460px, calc(100% - 44px));
          padding: 24px 0 72px;
        }

        .pageHeader {
          margin-bottom: 22px;
          padding: 2px 2px 0;
        }

        .pageHeader h1 {
          font-size: clamp(36px, 4.2vw, 52px);
          letter-spacing: -0.055em;
        }

        .headerActions {
          padding-top: 34px;
        }

        .secondaryButton,
        .primaryButton,
        .clearButton {
          min-height: 40px;
          border-radius: 11px;
          font-size: 11px;
          font-weight: 850;
        }

        .lookupCard,
        .studentCard,
        .eventSection,
        .historySection {
          border-radius: 20px;
          box-shadow: 0 8px 30px rgba(15, 23, 42, 0.045);
        }

        .lookupCard {
          border-color: #dfe6ef;
        }

        .sectionHeader,
        .eventSectionHeader,
        .historyHeader {
          padding: 22px 25px;
        }

        .sectionHeader h2,
        .eventSectionHeader h2,
        .historyHeader h2 {
          font-size: 21px;
        }

        .lookupRow {
          padding: 18px 25px 24px;
        }

        .searchInputWrap input {
          height: 52px;
          border-radius: 13px;
          background: #f9fbfd;
          font-size: 15px;
        }

        .lookupRow .primaryButton {
          min-width: 145px;
        }

        .studentCard {
          position: relative;
          overflow: hidden;
          margin-top: 14px;
          padding: 22px 24px;
        }

        .studentCard::before {
          content: "";
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 4px;
          background: #0b1f41;
        }

        .studentAvatar {
          width: 54px;
          height: 54px;
          flex-basis: 54px;
          border-radius: 16px;
        }

        .studentText h2 {
          font-size: 25px;
        }

        .studentMeta span {
          border-radius: 9px;
          background: #fbfcfe;
        }

        .statGrid {
          flex-basis: 390px;
        }

        .stat {
          min-height: 66px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          border: 1px solid #edf1f6;
        }

        .eventSection {
          margin-top: 18px;
        }

        .individualSection {
          border-color: #dfe6ef;
        }

        .teamSection {
          border-color: #ded5fa;
        }

        .eventSectionBody {
          padding: 22px 25px 25px;
        }

        .disciplineGroups {
          gap: 28px;
        }

        .disciplineGroup {
          padding: 0;
        }

        .disciplineHeader {
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid #f0f3f7;
        }

        .disciplineHeader h3 {
          font-size: 14px;
        }

        .eventGrid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .eventCard {
          min-height: 148px;
          padding: 14px;
          border-radius: 15px;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.025);
        }

        .eventCard:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 25px rgba(15, 23, 42, 0.075);
        }

        .eventCard.selected {
          padding: 13px;
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.07);
        }

        .eventIcon,
        .eventCheck {
          width: 36px;
          height: 36px;
          border-radius: 11px;
        }

        .eventCardBody {
          margin-top: 15px;
        }

        .eventCardBody h4 {
          font-size: 14px;
          line-height: 1.25;
        }

        .eventCardBottom {
          margin-top: 14px;
        }

        .teamInfo {
          margin: 17px 25px 0;
          padding: 14px 15px;
          border-radius: 13px;
        }

        .teamInfo p {
          max-width: 760px;
        }

        .saveBar {
          margin-top: 18px;
          bottom: 18px;
          border-radius: 17px;
          padding: 13px 16px 13px 18px;
          box-shadow: 0 16px 42px rgba(15, 23, 42, 0.15);
        }

        .saveSummary {
          min-width: 0;
        }

        .historySection {
          margin-top: 18px;
        }

        .historyHeader {
          padding-top: 21px;
          padding-bottom: 18px;
        }

        .historyFilters button {
          min-height: 32px;
          padding: 7px 11px;
          border: 1px solid #e8edf3;
        }

        .historyFilters button.active {
          border-color: #0b1f41;
        }

        .historyTableWrap th {
          padding: 12px 15px;
        }

        .historyTableWrap td {
          padding: 14px 15px;
        }

        @media (max-width: 1100px) {
          .registrationContainer {
            width: min(100% - 32px, 1040px);
          }

          .eventGrid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 820px) {
          .registrationContainer {
            width: min(100% - 28px, 760px);
          }

          .headerActions {
            width: 100%;
          }

          .secondaryButton {
            flex: 1;
          }

          .studentCard {
            padding: 19px;
          }

          .eventGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 520px) {
          .registrationContainer {
            width: calc(100% - 18px);
            padding-bottom: 64px;
          }

          .pageHeader h1 {
            font-size: 34px;
          }

          .lookupRow {
            gap: 8px;
          }

          .lookupRow .primaryButton,
          .lookupRow .clearButton {
            min-height: 44px;
          }

          .studentCard {
            padding: 16px;
          }

          .studentAvatar {
            width: 46px;
            height: 46px;
            flex-basis: 46px;
          }

          .studentText h2 {
            font-size: 21px;
          }

          .eventGrid {
            grid-template-columns: 1fr;
          }

          .eventCard {
            min-height: 132px;
          }

          .saveBar {
            bottom: 8px;
          }
        }
      `}</style>
    </main>
  );
}