"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  RefreshCw,
  Save,
  Scale,
  Upload,
  Users,
  Trophy,
} from "lucide-react";

type EventRecord = {
  id: string;
  category: string;
  name: string;
  format: string;
  discipline?: string | null;
  is_active?: boolean;
};

type EntryType = "student" | "team";
type ScoreEntry = {
  subjectKey: string;
  subjectType: EntryType;
  chestNo: number | null;
  label: string;
  house: string;
  category: string;
};

type ParticipantImportRow = {
  chestNo: number;
  name: string;
  studentId: string | null;
  valid: boolean;
  alreadyRegistered: boolean;
  reason: string;
};

type JudgementImportRow = {
  rowNumber: number;
  entryId: string;
  entryType: EntryType | "";
  indicators: number[];
  valid: boolean;
  reason: string;
};

type SavedScore = {
  id: string;
  event_id: string;
  judge_no: number;
  entry_type: EntryType;
  subject_key: string;
  student_id: string | null;
  team_id: string | null;
  indicator_1: number | string;
  indicator_2: number | string;
  indicator_3: number | string;
  indicator_4: number | string;
  indicator_5: number | string;
  updated_at?: string;
};

type HouseRecord = { id: string; name: string };

type TabName = "participants" | "judgement" | "consolidated";

const INDICATORS = [
  "Scoring Indicator 1",
  "Scoring Indicator 2",
  "Scoring Indicator 3",
  "Scoring Indicator 4",
  "Scoring Indicator 5",
];

function cleanHeader(value: unknown) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\uFE0E\uFE0F\u200B-\u200D]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function formatIsGroup(event: EventRecord | undefined) {
  return event?.format === "team" || event?.format === "relay";
}

function sumIndicators(score: SavedScore | undefined) {
  if (!score) return null;
  return [1, 2, 3, 4, 5].reduce(
    (sum, n) => sum + Number(score[`indicator_${n}` as keyof SavedScore] ?? 0),
    0
  );
}

function writeWorkbook(filename: string, sheetName: string, rows: unknown[][]) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = rows[0]?.map((cell) => ({ wch: Math.min(Math.max(String(cell ?? "").length + 3, 13), 30) }));
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName.slice(0, 31));
  XLSX.writeFile(workbook, filename);
}

function scoreIndicatorHeaderIndexes(header: unknown[]) {
  const indexes: number[] = [];
  for (let n = 1; n <= 5; n++) {
    indexes.push(
      header.findIndex((cell) => {
        const h = cleanHeader(cell);
        return h === `scoringindicator${n}` || h === `indicator${n}` || h === `criterion${n}` || h === `criteria${n}`;
      })
    );
  }
  return indexes;
}

export default function JudgingPage() {
  const supabase = useMemo(() => createClient(), []);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [eventId, setEventId] = useState("");
  const [activeTab, setActiveTab] = useState<TabName>("participants");
  const [judgeNo, setJudgeNo] = useState(1);
  const [entries, setEntries] = useState<ScoreEntry[]>([]);
  const [scores, setScores] = useState<SavedScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [participantFileName, setParticipantFileName] = useState("");
  const [participantPreview, setParticipantPreview] = useState<ParticipantImportRow[]>([]);
  const [participantProcessing, setParticipantProcessing] = useState(false);

  const [judgementFileName, setJudgementFileName] = useState("");
  const [judgementPreview, setJudgementPreview] = useState<JudgementImportRow[]>([]);
  const [judgementProcessing, setJudgementProcessing] = useState(false);

  const selectedEvent = events.find((event) => event.id === eventId);
  const groupEvent = formatIsGroup(selectedEvent);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: loadError } = await supabase
      .from("events")
      .select("id,category,name,format,discipline,is_active")
      .eq("is_active", true)
      .order("category", { ascending: true })
      .order("name", { ascending: true });
    if (loadError) {
      setError(`Unable to load events: ${loadError.message}`);
      setEvents([]);
    } else {
      const rows = (data ?? []) as EventRecord[];
      setEvents(rows);
      setEventId((current) => current || rows[0]?.id || "");
    }
    setLoading(false);
  }, [supabase]);

  const loadEventEntries = useCallback(async (targetEventId: string) => {
    if (!targetEventId) {
      setEntries([]);
      setScores([]);
      return;
    }

    setWorking(true);
    setError("");
    try {
      const event = events.find((item) => item.id === targetEventId);
      if (!event) return;

      const { data: housesData, error: housesError } = await supabase
        .from("houses")
        .select("id,name");
      if (housesError) throw new Error(housesError.message);
      const houses = new Map<string, string>(
        ((housesData ?? []) as HouseRecord[]).map((house): [string, string] => [house.id, house.name])
      );

      let nextEntries: ScoreEntry[] = [];
      if (formatIsGroup(event)) {
        const { data: teamData, error: teamError } = await supabase
          .from("event_teams")
          .select("id,house_id,team_name,is_active")
          .eq("event_id", targetEventId)
          .eq("is_active", true)
          .order("team_name", { ascending: true });
        if (teamError) throw new Error(teamError.message);
        nextEntries = (teamData ?? []).map((team: any) => ({
          subjectKey: team.id,
          subjectType: "team" as const,
          chestNo: null,
          label: String(team.team_name || `${houses.get(team.house_id) || "House"} team`),
          house: houses.get(team.house_id) || "—",
          category: event.category,
        }));
      } else {
        const { data: registrationData, error: registrationError } = await supabase
          .from("registrations")
          .select("student_id")
          .eq("event_id", targetEventId)
          .eq("status", "registered");
        if (registrationError) throw new Error(registrationError.message);
        const studentIds = Array.from(new Set((registrationData ?? []).map((row: any) => row.student_id).filter(Boolean)));
        if (studentIds.length) {
          const { data: studentData, error: studentError } = await supabase
            .from("students")
            .select("id,chest_no,name,class_name,category,house_id,is_active")
            .in("id", studentIds)
            .eq("is_active", true)
            .order("chest_no", { ascending: true });
          if (studentError) throw new Error(studentError.message);
          nextEntries = (studentData ?? []).map((student: any) => ({
            subjectKey: student.id,
            subjectType: "student" as const,
            chestNo: Number(student.chest_no),
            label: String(student.name || "Unnamed student"),
            house: houses.get(student.house_id) || "—",
            category: String(student.category || event.category),
          }));
        }
      }

      const { data: scoreData, error: scoreError } = await supabase
        .from("event_judgement_scores")
        .select("id,event_id,judge_no,entry_type,subject_key,student_id,team_id,indicator_1,indicator_2,indicator_3,indicator_4,indicator_5,updated_at")
        .eq("event_id", targetEventId);
      if (scoreError) throw new Error(scoreError.message);

      setEntries(nextEntries);
      setScores((scoreData ?? []) as SavedScore[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load this event's participants and scores.");
      setEntries([]);
      setScores([]);
    } finally {
      setWorking(false);
    }
  }, [events, supabase]);

  useEffect(() => { void loadEvents(); }, [loadEvents]);
  useEffect(() => {
    if (eventId && events.length) void loadEventEntries(eventId);
  }, [eventId, events, loadEventEntries]);

  function clearNotices() {
    setError("");
    setMessage("");
  }

  function downloadParticipantTemplate() {
    if (!selectedEvent) return;
    writeWorkbook(
      `Sargamiya_Participants_${selectedEvent.name.replace(/[^a-z0-9]+/gi, "_")}.xlsx`,
      "Participants",
      [
        ["Chest No", "Participant Name", "Class", "House"],
        ["", "", "", ""],
      ]
    );
  }

  async function processParticipantFile(file: File) {
    clearNotices();
    setParticipantPreview([]);
    setParticipantFileName(file.name);
    setParticipantProcessing(true);
    try {
      if (!selectedEvent) throw new Error("Select an event before importing participants.");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!firstSheet) throw new Error("The workbook does not contain a worksheet.");
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1, defval: null, raw: true });
      const headerIndex = matrix.findIndex((row) => row.some((cell) => ["chestno", "chestnumber", "chest"].includes(cleanHeader(cell))));
      if (headerIndex < 0) throw new Error("Could not find a Chest No column. Use the provided event-wise template.");
      const header = matrix[headerIndex] ?? [];
      const chestIndex = header.findIndex((cell) => ["chestno", "chestnumber", "chest"].includes(cleanHeader(cell)));
      const nameIndex = header.findIndex((cell) => ["participantname", "studentname", "nameofstudent", "name"].includes(cleanHeader(cell)));
      const rawRows = matrix.slice(headerIndex + 1).map((row) => ({
        chestNo: Number(row[chestIndex]),
        name: String(row[nameIndex] ?? "").trim(),
      })).filter((row) => row.chestNo > 0 && Number.isInteger(row.chestNo));
      const uniqueChestNos = Array.from(new Set(rawRows.map((row) => row.chestNo)));
      if (!uniqueChestNos.length) throw new Error("No valid Chest No values were found in the workbook.");

      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("id,chest_no,name,category,is_active")
        .in("chest_no", uniqueChestNos);
      if (studentError) throw new Error(studentError.message);
      const students = new Map<number, any>((studentData ?? []).map((student: any): [number, any] => [Number(student.chest_no), student]));

      const { data: registrationData, error: registrationError } = await supabase
        .from("registrations")
        .select("student_id,status")
        .eq("event_id", selectedEvent.id);
      if (registrationError) throw new Error(registrationError.message);
      const currentRegistrations = new Map<string, string>((registrationData ?? []).map((row: any): [string, string] => [row.student_id, row.status]));

      const seen = new Set<number>();
      const preview: ParticipantImportRow[] = rawRows.map((row) => {
        const student: any = students.get(row.chestNo);
        let reason = "";
        if (seen.has(row.chestNo)) reason = "Duplicate Chest No in uploaded file.";
        else if (!student) reason = "Student not found. Add the student before importing this event list.";
        else if (student.is_active === false) reason = "Student is inactive.";
        else if (student.category !== selectedEvent.category) reason = `Category mismatch: this event is ${selectedEvent.category}.`;
        seen.add(row.chestNo);
        const registered = student ? currentRegistrations.get(student.id) === "registered" : false;
        return {
          chestNo: row.chestNo,
          name: student?.name || row.name || "—",
          studentId: student?.id || null,
          valid: !reason && Boolean(student),
          alreadyRegistered: registered,
          reason,
        };
      });
      setParticipantPreview(preview);
      if (preview.every((row) => row.valid)) setMessage(`Validated ${preview.length} participant rows for ${selectedEvent.name}.`);
      else setError(`${preview.filter((row) => !row.valid).length} row(s) need attention. Valid rows may still be imported; invalid rows will be skipped.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to read the participant workbook.");
    } finally {
      setParticipantProcessing(false);
    }
  }

  async function importParticipants() {
    if (!selectedEvent) return;
    const validRows = participantPreview.filter((row) => row.valid && row.studentId && !row.alreadyRegistered);
    if (!validRows.length) {
      setError("There are no new valid participants to import for this event.");
      return;
    }
    setWorking(true);
    clearNotices();
    try {
      const payload = validRows.map((row) => ({
        student_id: row.studentId as string,
        event_id: selectedEvent.id,
        status: "registered",
        notes: `Imported event-wise participant list${participantFileName ? ` (${participantFileName})` : ""}`,
      }));
      const { error: importError } = await supabase
        .from("registrations")
        .upsert(payload, { onConflict: "student_id,event_id" });
      if (importError) throw new Error(importError.message);
      setMessage(`Imported ${payload.length} participant(s) into ${selectedEvent.name}. Existing registrations were left unchanged.`);
      setParticipantPreview([]);
      setParticipantFileName("");
      await loadEventEntries(selectedEvent.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to import participants.");
    } finally {
      setWorking(false);
    }
  }

  function downloadJudgementSheet() {
    if (!selectedEvent) return;
    if (!entries.length) {
      setError(groupEvent
        ? "No active group entries were found. Create the teams in Admin → Group Rosters first."
        : "No registered participants were found for this event.");
      return;
    }
    clearNotices();
    const header = ["Entry ID", "Entry Type", "Chest No", "Participant / Team", "House", "Judge No", ...INDICATORS];
    const rows = entries.map((entry) => [
      entry.subjectKey,
      entry.subjectType,
      entry.chestNo ?? "",
      entry.label,
      entry.house,
      judgeNo,
      "", "", "", "", "",
    ]);
    writeWorkbook(
      `Sargamiya_Judgement_${selectedEvent.name.replace(/[^a-z0-9]+/gi, "_")}_Judge_${judgeNo}.xlsx`,
      "Judgement Sheet",
      [header, ...rows]
    );
    setMessage(`Downloaded a judgement sheet for ${entries.length} entry/entries and Judge ${judgeNo}. Fill all five scoring indicators, then import the same workbook.`);
  }

  async function processJudgementFile(file: File) {
    clearNotices();
    setJudgementPreview([]);
    setJudgementFileName(file.name);
    setJudgementProcessing(true);
    try {
      if (!selectedEvent) throw new Error("Select an event before importing judgement marks.");
      if (!entries.length) throw new Error("This event has no scoring entries. Register participants or configure group rosters first.");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error("The workbook does not contain a worksheet.");
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: true });
      const headerIndex = matrix.findIndex((row) => row.some((cell) => cleanHeader(cell) === "entryid"));
      if (headerIndex < 0) throw new Error("Could not find the Entry ID column. Download the judgement sheet for this event and judge, then fill in its five scoring indicators.");
      const header = matrix[headerIndex] ?? [];
      const entryIdIndex = header.findIndex((cell) => ["entryid", "subjectkey"].includes(cleanHeader(cell)));
      const entryTypeIndex = header.findIndex((cell) => ["entrytype", "subjecttype"].includes(cleanHeader(cell)));
      const judgeIndex = header.findIndex((cell) => ["judgeno", "judgenumber"].includes(cleanHeader(cell)));
      const indicatorIndexes = scoreIndicatorHeaderIndexes(header);
      if (indicatorIndexes.some((index) => index < 0)) {
        throw new Error("All five scoring columns are required. Use the downloaded sheet with Scoring Indicator 1–5 headings.");
      }
      const entryMap = new Map<string, ScoreEntry>(entries.map((entry): [string, ScoreEntry] => [entry.subjectKey, entry]));
      const seen = new Set<string>();
      const preview: JudgementImportRow[] = [];
      for (let index = headerIndex + 1; index < matrix.length; index++) {
        const row = matrix[index] ?? [];
        const entryId = String(row[entryIdIndex] ?? "").trim();
        const rawIndicators = indicatorIndexes.map((columnIndex) => row[columnIndex]);
        if (!entryId && rawIndicators.every((value) => value === null || String(value ?? "").trim() === "")) continue;
        const entryTypeText = String(row[entryTypeIndex] ?? "").trim().toLowerCase();
        const entryType = entryTypeText === "student" || entryTypeText === "team" ? entryTypeText as EntryType : "";
        const entry = entryMap.get(entryId);
        let reason = "";
        if (!entryId) reason = "Missing Entry ID.";
        else if (!entry) reason = "Entry ID does not belong to this event's current participant/team list.";
        else if (!entryType) reason = "Missing or invalid Entry Type.";
        else if (entryType !== entry.subjectType) reason = "Entry Type does not match the selected event entry.";
        else if (seen.has(entryId)) reason = "Duplicate Entry ID in this judgement sheet.";
        if (judgeIndex >= 0 && row[judgeIndex] !== null && String(row[judgeIndex]).trim() !== "" && Number(row[judgeIndex]) !== judgeNo) {
          reason = `Judge No in this sheet does not match the selected Judge ${judgeNo}.`;
        }
        const indicators = rawIndicators.map((value) => value === null || String(value ?? "").trim() === "" ? NaN : Number(value));
        if (!reason && indicators.some((value) => !Number.isFinite(value) || value < 0)) {
          reason = "Enter a non-negative number for each of the five scoring indicators.";
        }
        if (entryId) seen.add(entryId);
        preview.push({ rowNumber: index + 1, entryId, entryType, indicators, valid: !reason, reason });
      }
      if (!preview.length) throw new Error("No judgement rows were found in the workbook.");
      setJudgementPreview(preview);
      const invalidCount = preview.filter((row) => !row.valid).length;
      if (invalidCount) setError(`${invalidCount} judgement row(s) need correction. No marks will be saved until all rows are valid.`);
      else setMessage(`Validated ${preview.length} judgement row(s) for Judge ${judgeNo}. Review and save the marks.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to read the judgement workbook.");
    } finally {
      setJudgementProcessing(false);
    }
  }

  async function saveJudgementScores() {
    if (!selectedEvent) return;
    if (!judgementPreview.length || judgementPreview.some((row) => !row.valid)) {
      setError("Correct the judgement sheet errors before saving. No partial import has been made.");
      return;
    }
    setWorking(true);
    clearNotices();
    try {
      const payload = judgementPreview.map((row) => ({
        event_id: selectedEvent.id,
        judge_no: judgeNo,
        entry_type: row.entryType,
        subject_key: row.entryId,
        student_id: row.entryType === "student" ? row.entryId : null,
        team_id: row.entryType === "team" ? row.entryId : null,
        indicator_1: row.indicators[0],
        indicator_2: row.indicators[1],
        indicator_3: row.indicators[2],
        indicator_4: row.indicators[3],
        indicator_5: row.indicators[4],
      }));
      const { error: saveError } = await supabase
        .from("event_judgement_scores")
        .upsert(payload, { onConflict: "event_id,judge_no,subject_key" });
      if (saveError) throw new Error(saveError.message);
      setMessage(`Saved ${payload.length} judgement score(s) for ${selectedEvent.name}, Judge ${judgeNo}. Re-importing the same entry updates that judge's scores.`);
      setJudgementPreview([]);
      setJudgementFileName("");
      await loadEventEntries(selectedEvent.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save judgement scores.");
    } finally {
      setWorking(false);
    }
  }

  const scoresBySubjectAndJudge = useMemo(() => {
    const map = new Map<string, SavedScore>();
    for (const score of scores) map.set(`${score.subject_key}:${score.judge_no}`, score);
    return map;
  }, [scores]);

  const consolidatedRows = useMemo(() => {
    const rows = entries.map((entry) => {
      const byJudge = [1, 2, 3].map((judge) => scoresBySubjectAndJudge.get(`${entry.subjectKey}:${judge}`));
      const totals = byJudge.map((score) => sumIndicators(score));
      const complete = totals.every((total) => total !== null);
      const grandTotal = complete ? (totals as number[]).reduce((sum, total) => sum + total, 0) : null;
      return { entry, byJudge, totals, complete, grandTotal, average: grandTotal === null ? null : grandTotal / 3, rank: null as number | null };
    });
    const completeRows = rows.filter((row) => row.complete).sort((a, b) => (b.grandTotal ?? 0) - (a.grandTotal ?? 0));
    let lastTotal: number | null = null;
    let lastRank = 0;
    completeRows.forEach((row, index) => {
      if (row.grandTotal !== lastTotal) lastRank = index + 1;
      row.rank = lastRank;
      lastTotal = row.grandTotal;
    });
    return rows.sort((a, b) => {
      if (a.complete !== b.complete) return a.complete ? -1 : 1;
      if (a.complete && b.complete) return (b.grandTotal ?? 0) - (a.grandTotal ?? 0);
      return a.entry.label.localeCompare(b.entry.label);
    });
  }, [entries, scoresBySubjectAndJudge]);

  function downloadConsolidatedSheet() {
    if (!selectedEvent) return;
    const header = [
      "Position", "Entry Type", "Chest No", "Participant / Team", "House",
      ...[1, 2, 3].flatMap((judge) => [
        ...INDICATORS.map((indicator) => `Judge ${judge} - ${indicator}`),
        `Judge ${judge} Total`,
      ]),
      "Consolidated Total (3 Judges)", "Average per Judge", "Completion Status",
    ];
    const rows = consolidatedRows.map((row) => [
      row.rank ?? "Pending",
      row.entry.subjectType,
      row.entry.chestNo ?? "",
      row.entry.label,
      row.entry.house,
      ...row.byJudge.flatMap((score) => [
        ...[1, 2, 3, 4, 5].map((n) => score ? Number(score[`indicator_${n}` as keyof SavedScore] ?? 0) : ""),
        score ? sumIndicators(score) : "",
      ]),
      row.grandTotal ?? "",
      row.average === null ? "" : Number(row.average.toFixed(2)),
      row.complete ? "Complete - all 3 judges" : `Pending - ${row.totals.filter((total) => total !== null).length}/3 judges`,
    ]);
    writeWorkbook(
      `Sargamiya_Consolidated_Scores_${selectedEvent.name.replace(/[^a-z0-9]+/gi, "_")}.xlsx`,
      "Consolidated Scores",
      [header, ...rows]
    );
    setMessage("Downloaded the consolidated workbook. Entries without all three judge scores are marked Pending and are not ranked.");
  }

  async function refreshScores() {
    if (eventId) await loadEventEntries(eventId);
  }

  function handleParticipantFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void processParticipantFile(file);
    event.target.value = "";
  }
  function handleJudgementFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void processJudgementFile(file);
    event.target.value = "";
  }

  const registeredEntryCount = entries.length;
  const completedEntryCount = consolidatedRows.filter((row) => row.complete).length;
  const displayedScoringRows = scores.filter((score) => score.judge_no === judgeNo).length;

  return (
    <div className="judgingPage">
      <style jsx>{`
        .judgingPage{max-width:1500px;margin:0 auto;padding:26px;color:var(--foreground,#172033)}
        .pageHeading{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;margin-bottom:22px}
        .eyebrow{font-size:11px;font-weight:800;letter-spacing:.15em;text-transform:uppercase;color:#2563eb;margin:0 0 7px}
        h1{font-size:clamp(25px,3vw,34px);line-height:1.15;margin:0;font-weight:800;letter-spacing:-.035em}
        .subhead{color:#657085;margin:9px 0 0;max-width:720px;line-height:1.55;font-size:14px}
        .eventPicker{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #dce3ed;border-radius:14px;padding:12px 14px;min-width:min(100%,420px);box-shadow:0 4px 14px rgba(16,34,66,.04)}
        .eventPicker label{font-size:12px;color:#667085;font-weight:700;white-space:nowrap}
        .eventPicker select{width:100%;min-width:0;border:0;outline:0;background:transparent;color:#172033;font:inherit;font-weight:700}
        .tabBar{display:flex;flex-wrap:wrap;gap:8px;padding:6px;background:#edf2f8;border:1px solid #e0e7f0;border-radius:15px;margin-bottom:18px}
        .tabButton{border:0;border-radius:10px;background:transparent;padding:12px 15px;color:#4d5c72;display:inline-flex;align-items:center;gap:9px;font-weight:750;cursor:pointer}
        .tabButton[aria-selected=true]{background:#fff;color:#173a72;box-shadow:0 2px 8px rgba(18,45,84,.09)}
        .panel{background:#fff;border:1px solid #e0e6ef;border-radius:18px;padding:22px;box-shadow:0 8px 26px rgba(20,38,72,.035)}
        .panelHead{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;margin-bottom:17px}
        .panelHead h2{font-size:20px;margin:0 0 6px;letter-spacing:-.02em}
        .panelHead p{color:#667085;font-size:13px;line-height:1.5;margin:0}
        .chip{background:#eef4ff;color:#174ea6;border-radius:999px;padding:7px 10px;font-weight:750;font-size:12px;white-space:nowrap}
        .buttonRow{display:flex;flex-wrap:wrap;gap:10px;margin:17px 0}
        .primaryButton,.secondaryButton{border:1px solid #d5dfea;background:#fff;border-radius:11px;min-height:42px;padding:10px 14px;display:inline-flex;align-items:center;justify-content:center;gap:8px;font-weight:750;font-size:13px;cursor:pointer;color:#23324b;text-decoration:none}
        .primaryButton{background:#153d78;color:#fff;border-color:#153d78}
        .primaryButton:disabled,.secondaryButton:disabled{opacity:.48;cursor:not-allowed}
        .fileLabel{position:relative;overflow:hidden}
        .fileLabel input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}
        .infoStrip{display:flex;align-items:flex-start;gap:10px;padding:13px 14px;background:#f4f7fc;border:1px solid #e2e9f4;color:#46546a;border-radius:12px;font-size:13px;line-height:1.5;margin:14px 0}
        .notice{padding:12px 14px;border-radius:11px;display:flex;align-items:flex-start;gap:9px;font-size:13px;line-height:1.5;margin:0 0 14px}
        .notice.error{background:#fff1f0;border:1px solid #fecaca;color:#a52828}
        .notice.success{background:#effaf3;border:1px solid #b8e7c6;color:#17643a}
        .tableWrap{overflow:auto;border:1px solid #e1e7ef;border-radius:12px;margin-top:15px}
        table{width:100%;border-collapse:collapse;font-size:13px;min-width:650px}
        th{background:#f6f8fb;color:#536176;font-size:11px;text-transform:uppercase;letter-spacing:.04em;font-weight:800;text-align:left;white-space:nowrap}
        th,td{padding:11px 12px;border-bottom:1px solid #edf0f5}
        tr:last-child td{border-bottom:0}
        td{color:#344258}
        .muted{color:#7b8798}
        .statusPill{display:inline-flex;align-items:center;gap:5px;border-radius:99px;padding:4px 8px;font-size:11px;font-weight:800;background:#eaf8ef;color:#21643c}
        .statusPill.bad{background:#fff0ed;color:#ad2e20}
        .summaryGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:16px 0}
        .summaryCard{border:1px solid #e1e7ef;background:#fbfcfe;border-radius:13px;padding:14px}
        .summaryCard span{display:block;font-size:11px;color:#6d798c;font-weight:750;text-transform:uppercase;letter-spacing:.05em}
        .summaryCard strong{display:block;font-size:25px;line-height:1.2;margin-top:7px;letter-spacing:-.035em;color:#19355f}
        .smallLabel{display:block;color:#67758a;font-size:12px;font-weight:750;margin:0 0 7px}
        .inlineField{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:12px 0}
        .inlineField select{border:1px solid #d8e0eb;border-radius:10px;padding:10px 12px;background:#fff;min-width:140px;font:inherit;color:#1d2b40}
        .emptyState{text-align:center;color:#758198;padding:30px 14px}
        .emptyState strong{display:block;color:#344258;font-size:15px;margin:9px 0 5px}
        .rank{font-weight:900;color:#174ea6}
        @media(max-width:850px){.pageHeading{display:block}.eventPicker{margin-top:18px;min-width:0}.summaryGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.panel{padding:16px}.panelHead{display:block}.chip{display:inline-flex;margin-top:10px}}
        @media(max-width:500px){.judgingPage{padding:14px}.tabButton{flex:1;justify-content:center;padding:11px 8px;font-size:12px}.summaryGrid{gap:8px}.summaryCard{padding:11px}.summaryCard strong{font-size:22px}}
      `}</style>

      <div className="pageHeading">
        <div>
          <p className="eyebrow">Sargamiya 2026 · Competition Desk</p>
          <h1>Judging & Score Consolidation</h1>
          <p className="subhead">Import event-wise participants, prepare five-indicator judgement sheets for each of three judges, and consolidate their marks into a ranked score sheet.</p>
        </div>
        <div className="eventPicker">
          <label htmlFor="judging-event">EVENT</label>
          <select id="judging-event" value={eventId} onChange={(e) => { setEventId(e.target.value); setParticipantPreview([]); setJudgementPreview([]); clearNotices(); }} disabled={loading || events.length === 0}>
            {events.length === 0 && <option value="">No events available</option>}
            {events.map((event) => <option key={event.id} value={event.id}>{event.category} · {event.name}</option>)}
          </select>
        </div>
      </div>

      {error && <div className="notice error"><AlertCircle size={18} /> <span>{error}</span></div>}
      {message && <div className="notice success"><CheckCircle2 size={18} /> <span>{message}</span></div>}

      <div className="tabBar" role="tablist" aria-label="Judging workflows">
        <button className="tabButton" role="tab" aria-selected={activeTab === "participants"} onClick={() => { setActiveTab("participants"); clearNotices(); }}><Users size={17} /> Participants Import</button>
        <button className="tabButton" role="tab" aria-selected={activeTab === "judgement"} onClick={() => { setActiveTab("judgement"); clearNotices(); }}><ClipboardList size={17} /> Judgement Sheets</button>
        <button className="tabButton" role="tab" aria-selected={activeTab === "consolidated"} onClick={() => { setActiveTab("consolidated"); clearNotices(); }}><Scale size={17} /> Consolidated Scores</button>
      </div>

      {activeTab === "participants" && <section className="panel">
        <div className="panelHead">
          <div><h2>Import Participant List — Event Wise</h2><p>Choose one event above, then upload a list of Chest Numbers. Students must already exist in the student register and match the event category.</p></div>
          <span className="chip">{selectedEvent?.category || "Select event"}</span>
        </div>
        <div className="infoStrip"><FileSpreadsheet size={18} /><span>Use the template headings <strong>Chest No</strong> and <strong>Participant Name</strong>. Chest No is the matching key; name, class and house columns are informational. Only valid students in this event’s category are registered.</span></div>
        <div className="buttonRow">
          <button className="secondaryButton" onClick={downloadParticipantTemplate} disabled={!selectedEvent}><Download size={16} /> Download Participant Template</button>
          <label className="primaryButton fileLabel"><Upload size={16} /> {participantProcessing ? "Reading workbook…" : "Choose Participant Excel"}<input type="file" accept=".xlsx,.xls,.csv" onChange={handleParticipantFileChange} disabled={!selectedEvent || participantProcessing} /></label>
          <button className="secondaryButton" onClick={() => void refreshScores()} disabled={working}><RefreshCw size={16} /> Refresh</button>
        </div>
        {participantFileName && <p className="muted">Selected file: <strong>{participantFileName}</strong></p>}
        {participantPreview.length > 0 && <>
          <div className="summaryGrid">
            <div className="summaryCard"><span>Rows Read</span><strong>{participantPreview.length}</strong></div>
            <div className="summaryCard"><span>Valid Rows</span><strong>{participantPreview.filter((row) => row.valid).length}</strong></div>
            <div className="summaryCard"><span>Already Registered</span><strong>{participantPreview.filter((row) => row.valid && row.alreadyRegistered).length}</strong></div>
            <div className="summaryCard"><span>Issues</span><strong>{participantPreview.filter((row) => !row.valid).length}</strong></div>
          </div>
          <div className="tableWrap"><table><thead><tr><th>Chest No</th><th>Participant</th><th>Import Status</th><th>Notes</th></tr></thead><tbody>
            {participantPreview.map((row, index) => <tr key={`${row.chestNo}-${index}`}><td>{row.chestNo}</td><td>{row.name}</td><td>{row.alreadyRegistered && row.valid ? <span className="statusPill">Already registered</span> : row.valid ? <span className="statusPill">Ready</span> : <span className="statusPill bad">Needs attention</span>}</td><td>{row.reason || (row.alreadyRegistered ? "Existing registration will be kept." : "Ready to register.")}</td></tr>)}
          </tbody></table></div>
          <div className="buttonRow"><button className="primaryButton" onClick={() => void importParticipants()} disabled={working || participantPreview.every((row) => !row.valid || row.alreadyRegistered)}><Save size={16} /> {working ? "Importing…" : `Import Valid Participants (${participantPreview.filter((row) => row.valid && !row.alreadyRegistered).length})`}</button><button className="secondaryButton" onClick={() => { setParticipantPreview([]); setParticipantFileName(""); }}>Clear Preview</button></div>
        </>}
        {!participantPreview.length && <div className="emptyState"><Users size={30} /><strong>Event-wise registration</strong>Import a spreadsheet to register students for {selectedEvent?.name || "the selected event"}.</div>}
      </section>}

      {activeTab === "judgement" && <section className="panel">
        <div className="panelHead"><div><h2>Import Judgement Sheet</h2><p>Each judge scores every entry against five indicators. Importing a revised sheet updates the selected judge’s saved marks for that event.</p></div><span className="chip">5 indicators · 3 judges</span></div>
        <div className="inlineField"><label className="smallLabel" htmlFor="judge-select">JUDGE</label><select id="judge-select" value={judgeNo} onChange={(e) => { setJudgeNo(Number(e.target.value)); setJudgementPreview([]); setJudgementFileName(""); clearNotices(); }}><option value={1}>Judge 1</option><option value={2}>Judge 2</option><option value={3}>Judge 3</option></select><span className="muted">Saved scores for this judge: <strong>{displayedScoringRows}</strong></span></div>
        <div className="infoStrip"><ClipboardList size={18} /><span>Download the event-specific sheet, enter a non-negative number in <strong>all five scoring indicators</strong> for every row, and keep the Entry ID and Entry Type columns unchanged. Decimal marks are supported. Blank scoring cells are rejected rather than treated as zero.</span></div>
        <div className="buttonRow"><button className="secondaryButton" onClick={downloadJudgementSheet} disabled={!selectedEvent || !entries.length || working}><Download size={16} /> Download Judge {judgeNo} Sheet</button><label className="primaryButton fileLabel"><Upload size={16} /> {judgementProcessing ? "Validating…" : "Choose Completed Judgement Sheet"}<input type="file" accept=".xlsx,.xls,.csv" onChange={handleJudgementFileChange} disabled={!selectedEvent || judgementProcessing || !entries.length} /></label><button className="secondaryButton" onClick={() => void refreshScores()} disabled={working}><RefreshCw size={16} /> Refresh</button></div>
        {groupEvent && entries.length === 0 && <div className="notice error"><AlertCircle size={18}/><span>This is a group event. Create active house teams under <strong>Admin → Group Rosters</strong> before generating the judgement sheet.</span></div>}
        {judgementFileName && <p className="muted">Selected file: <strong>{judgementFileName}</strong></p>}
        {judgementPreview.length > 0 && <>
          <div className="summaryGrid"><div className="summaryCard"><span>Rows Read</span><strong>{judgementPreview.length}</strong></div><div className="summaryCard"><span>Valid</span><strong>{judgementPreview.filter((row) => row.valid).length}</strong></div><div className="summaryCard"><span>Invalid</span><strong>{judgementPreview.filter((row) => !row.valid).length}</strong></div><div className="summaryCard"><span>Judge</span><strong>{judgeNo} / 3</strong></div></div>
          <div className="tableWrap"><table><thead><tr><th>Excel Row</th><th>Entry ID</th><th>Indicator 1</th><th>Indicator 2</th><th>Indicator 3</th><th>Indicator 4</th><th>Indicator 5</th><th>Validation</th></tr></thead><tbody>
            {judgementPreview.map((row) => <tr key={`${row.rowNumber}-${row.entryId}`}><td>{row.rowNumber}</td><td><span title={row.entryId}>{row.entryId.slice(0, 8)}…</span></td>{[0,1,2,3,4].map((n) => <td key={n}>{Number.isFinite(row.indicators[n]) ? row.indicators[n] : "—"}</td>)}<td>{row.valid ? <span className="statusPill">Ready</span> : <span className="statusPill bad">{row.reason}</span>}</td></tr>)}
          </tbody></table></div>
          <div className="buttonRow"><button className="primaryButton" onClick={() => void saveJudgementScores()} disabled={working || judgementPreview.some((row) => !row.valid)}><Save size={16} /> {working ? "Saving marks…" : `Save ${judgementPreview.length} Judgement Rows`}</button><button className="secondaryButton" onClick={() => { setJudgementPreview([]); setJudgementFileName(""); }}>Clear Preview</button></div>
          {judgementPreview.some((row) => !row.valid) && <p className="muted">Correct the errors in Excel and select the file again. The system will not save a partial judgement sheet.</p>}
        </>}
        {!judgementPreview.length && <div className="emptyState"><ClipboardList size={30}/><strong>Five indicators per judge</strong>Current event entries: {entries.length}. Download a fresh sheet or import a completed one.</div>}
      </section>}

      {activeTab === "consolidated" && <section className="panel">
        <div className="panelHead"><div><h2>Consolidated Score Sheet</h2><p>Combines the five indicator marks from all three judges. Consolidated Total is the sum of all 15 marks; Average per Judge is that total divided by three. Only entries with all three judges completed are ranked.</p></div><span className="chip">{selectedEvent?.name || "Select event"}</span></div>
        <div className="summaryGrid"><div className="summaryCard"><span>Entries</span><strong>{registeredEntryCount}</strong></div><div className="summaryCard"><span>Fully Scored</span><strong>{completedEntryCount}</strong></div><div className="summaryCard"><span>Pending Scores</span><strong>{Math.max(registeredEntryCount - completedEntryCount, 0)}</strong></div><div className="summaryCard"><span>Judges per Event</span><strong>3</strong></div></div>
        <div className="buttonRow"><button className="primaryButton" onClick={downloadConsolidatedSheet} disabled={!selectedEvent || !entries.length}><Download size={16}/> Download Consolidated Excel</button><button className="secondaryButton" onClick={() => void refreshScores()} disabled={working}><RefreshCw size={16}/> Refresh Scores</button></div>
        {entries.length > 0 ? <div className="tableWrap"><table><thead><tr><th>Rank</th><th>Participant / Team</th><th>House</th><th>Judge 1</th><th>Judge 2</th><th>Judge 3</th><th>Consolidated Total</th><th>Average</th><th>Status</th></tr></thead><tbody>
          {consolidatedRows.map((row) => <tr key={row.entry.subjectKey}><td className="rank">{row.rank ?? "—"}</td><td><strong>{row.entry.label}</strong>{row.entry.chestNo !== null && <div className="muted">Chest No: {row.entry.chestNo}</div>}</td><td>{row.entry.house}</td>{row.totals.map((total, index) => <td key={index}>{total === null ? "—" : total.toFixed(2).replace(/\.00$/, "")}</td>)}<td><strong>{row.grandTotal === null ? "—" : row.grandTotal.toFixed(2).replace(/\.00$/, "")}</strong></td><td>{row.average === null ? "—" : row.average.toFixed(2)}</td><td>{row.complete ? <span className="statusPill"><CheckCircle2 size={12}/> Complete</span> : <span className="statusPill bad">Pending {row.totals.filter((total) => total !== null).length}/3</span>}</td></tr>)}
        </tbody></table></div> : <div className="emptyState"><Trophy size={30}/><strong>No scoring entries yet</strong>{groupEvent ? "Create teams in Group Rosters to score this group event." : "Import the event-wise participant list or create registrations first."}</div>}
        <div className="infoStrip"><Scale size={18}/><span>Ranking is based on consolidated total (equivalent to ranking by average). Tied totals share the same rank. The consolidated sheet is a judging report; it does not automatically publish official results or award house points.</span></div>
      </section>}

      {loading && <div className="notice success"><LoaderCircle size={18} className="spin"/> Loading the event catalogue…</div>}
      {working && <div className="muted" style={{display:"flex",alignItems:"center",gap:8,marginTop:14}}><LoaderCircle size={15}/> Saving or refreshing data…</div>}
    </div>
  );
}
