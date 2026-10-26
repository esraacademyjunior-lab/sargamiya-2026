"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Search,
  Trophy,
  Users,
  Sparkles,
} from "lucide-react";

type EventStatusRow = {
  event_id: string;
  category: string;
  event_name: string;
  discipline: string;
  event_format: string;
  is_active: boolean;
  results_declared: boolean | null;
  has_top_three_positions: boolean | null;
  result_entries: number | null;
  official_results: number | null;
  last_result_at: string | null;
  scheduled_date: string | null;
  start_time: string | null;
  end_time: string | null;
  venue: string | null;
};

type PublicResult = {
  result_id: string;
  event_id: string;
  category: string;
  discipline: string;
  event_name: string;
  event_format: string;
  position: number | null;
  result_value: number | null;
  result_unit: string | null;
  points_awarded: number | null;
  participant_name: string | null;
  chest_no: number | string | null;
  house: string | null;
  updated_at: string | null;
};

type ScheduleStatus = "declared" | "pending" | "toConduct";
type StudentStanding = {
  key: string;
  category: string;
  name: string;
  chestNo: string | null;
  house: string | null;
  points: number;
  firsts: number;
  seconds: number;
  thirds: number;
};

const CATEGORY_ORDER = ["Junior Boys", "Junior Girls", "Senior Boys", "Senior Girls"];

function numberValue(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Date not scheduled";
  const date = new Date(`${value.slice(0, 10)}T00:00:00+05:30`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

function formatTime(value: string | null | undefined) {
  if (!value) return "Time TBA";
  const match = value.slice(0, 5).match(/^(\d{2}):(\d{2})$/);
  if (!match) return value;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}

function scheduleStamp(date: string | null, time: string | null) {
  if (!date || !time) return null;
  const stamp = new Date(`${date.slice(0, 10)}T${time.slice(0, 8)}+05:30`).getTime();
  return Number.isFinite(stamp) ? stamp : null;
}

function classifyEvent(event: EventStatusRow, now: number): ScheduleStatus {
  if (event.results_declared || event.has_top_three_positions) return "declared";
  if ((event.result_entries ?? 0) > 0) return "pending";
  const end = scheduleStamp(event.scheduled_date, event.end_time || event.start_time);
  if (end !== null && end < now) return "pending";
  return "toConduct";
}

function positionLabel(position: number | null) {
  if (position === 1) return "1st";
  if (position === 2) return "2nd";
  if (position === 3) return "3rd";
  return position ? `${position}th` : "—";
}

function medalEmoji(position: number | null) {
  if (position === 1) return "🥇";
  if (position === 2) return "🥈";
  if (position === 3) return "🥉";
  return "•";
}

function buildStudentStandings(results: PublicResult[]): StudentStanding[] {
  const standings = new Map<string, StudentStanding>();
  results.forEach((result) => {
    if (result.event_format !== "individual" || !result.participant_name || !result.position || result.position > 3) return;
    const chestNo = result.chest_no === null || result.chest_no === undefined ? null : String(result.chest_no);
    const key = `${result.category}|${chestNo ?? ""}|${result.participant_name}|${result.house ?? ""}`;
    const standing = standings.get(key) ?? {
      key,
      category: result.category,
      name: result.participant_name,
      chestNo,
      house: result.house,
      points: 0,
      firsts: 0,
      seconds: 0,
      thirds: 0,
    };
    standing.points += numberValue(result.points_awarded) ?? 0;
    if (result.position === 1) standing.firsts += 1;
    if (result.position === 2) standing.seconds += 1;
    if (result.position === 3) standing.thirds += 1;
    standings.set(key, standing);
  });

  return Array.from(standings.values())
    .filter((item) => item.points > 0)
    .sort((a, b) =>
      b.points - a.points ||
      b.firsts - a.firsts ||
      b.seconds - a.seconds ||
      b.thirds - a.thirds ||
      a.name.localeCompare(b.name)
    );
}

export default function PublicResultsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [eventRows, setEventRows] = useState<EventStatusRow[]>([]);
  const [results, setResults] = useState<PublicResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [now, setNow] = useState(() => Date.now());
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadData = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [eventsResponse, resultsResponse] = await Promise.all([
        supabase
          .from("athlon_public_event_status")
          .select("event_id,category,event_name,discipline,event_format,is_active,results_declared,has_top_three_positions,result_entries,official_results,last_result_at,scheduled_date,start_time,end_time,venue")
          .eq("is_active", true)
          .order("category", { ascending: true })
          .order("event_name", { ascending: true }),
        supabase
          .from("athlon_public_declared_results")
          .select("result_id,event_id,category,discipline,event_name,event_format,position,result_value,result_unit,points_awarded,participant_name,chest_no,house,updated_at")
          .order("position", { ascending: true, nullsFirst: false }),
      ]);

      if (eventsResponse.error) throw new Error(eventsResponse.error.message);
      if (resultsResponse.error) throw new Error(resultsResponse.error.message);

      setEventRows((eventsResponse.data ?? []) as EventStatusRow[]);
      setResults((resultsResponse.data ?? []) as PublicResult[]);
      setLastUpdated(new Date());
    } catch (cause) {
      console.error("PUBLIC RESULTS LOAD ERROR:", cause);
      setError(cause instanceof Error ? cause.message : "Unable to load public results.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadData();
    const poll = window.setInterval(() => {
      setNow(Date.now());
      void loadData(true);
    }, 15000);
    const clock = window.setInterval(() => setNow(Date.now()), 30000);
    const channel = supabase
      .channel("public-results-page-refresh")
      .on("postgres_changes", { event: "*", schema: "public", table: "results" }, () => void loadData(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => void loadData(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "event_schedule" }, () => void loadData(true))
      .subscribe();
    return () => {
      window.clearInterval(poll);
      window.clearInterval(clock);
      void supabase.removeChannel(channel);
    };
  }, [loadData, supabase]);

  const resultMap = useMemo(() => {
    const map = new Map<string, PublicResult[]>();
    results.forEach((row) => {
      const rows = map.get(row.event_id) ?? [];
      rows.push(row);
      map.set(row.event_id, rows);
    });
    for (const [eventId, rows] of map) {
      rows.sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
      map.set(eventId, rows);
    }
    return map;
  }, [results]);

  const categories = useMemo(() => {
    const values = new Set(eventRows.map((event) => event.category).filter(Boolean));
    return [
      ...CATEGORY_ORDER.filter((category) => values.has(category)),
      ...Array.from(values).filter((category) => !CATEGORY_ORDER.includes(category)).sort(),
    ];
  }, [eventRows]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return eventRows.filter((event) => {
      const inCategory = categoryFilter === "all" || event.category === categoryFilter;
      const inSearch = !query || `${event.event_name} ${event.category} ${event.discipline} ${event.venue ?? ""}`.toLowerCase().includes(query);
      return inCategory && inSearch;
    });
  }, [eventRows, categoryFilter, search]);

  const groups = useMemo(() => {
    const result: Record<ScheduleStatus, EventStatusRow[]> = { declared: [], pending: [], toConduct: [] };
    filteredRows.forEach((event) => result[classifyEvent(event, now)].push(event));
    return result;
  }, [filteredRows, now]);

  const studentStandings = useMemo(() => {
    const all = buildStudentStandings(results);
    return categories.map((category) => ({
      category,
      students: all.filter((student) => student.category === category).slice(0, 3),
    }));
  }, [results, categories]);

  const totalDeclared = eventRows.filter((event) => classifyEvent(event, now) === "declared").length;
  const totalPending = eventRows.filter((event) => classifyEvent(event, now) === "pending").length;
  const totalToConduct = eventRows.filter((event) => classifyEvent(event, now) === "toConduct").length;

  function renderStatusEvent(event: EventStatusRow, status: ScheduleStatus) {
    const publishedRows = (resultMap.get(event.event_id) ?? []).filter((row) => row.position === 1 || row.position === 2 || row.position === 3);
    const sortedPlacements = [...publishedRows].sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
    const scheduleLine = [
      event.scheduled_date ? formatDate(event.scheduled_date) : null,
      event.start_time ? formatTime(event.start_time) : null,
      event.venue || null,
    ].filter(Boolean).join(" · ");

    return (
      <article className={`publicEventCard publicEvent-${status}`} key={event.event_id}>
        <div className="publicEventTopline">
          <span className="categoryTag">{event.category}</span>
          <span className={`statusPill statusPill-${status}`}>
            {status === "declared" ? "Results Declared" : status === "pending" ? "Results Pending" : "To Be Conducted"}
          </span>
        </div>
        <h3>{event.event_name}</h3>
        <p className="eventDiscipline">{event.discipline || event.event_format}</p>
        {scheduleLine && <div className="scheduleMeta"><CalendarDays size={14} /> {scheduleLine}</div>}
        {status === "declared" ? (
          <div className="placementsBlock">
            <div className="placementsCaption"><Trophy size={14} /> TOP PLACEMENTS</div>
            {sortedPlacements.length > 0 ? (
              <div className="placementList">
                {sortedPlacements.map((row) => (
                  <div className={`placementRow placement-${row.position}`} key={row.result_id}>
                    <span className="placementMedal">{medalEmoji(row.position)}</span>
                    <span className="placementPosition">{positionLabel(row.position)}</span>
                    <span className="placementName">{row.participant_name || "Participant"}</span>
                    <span className="placementMetadata">
                      {[
                        row.chest_no !== null && row.chest_no !== undefined ? `#${row.chest_no}` : null,
                        row.house || null,
                        row.result_value !== null && row.result_value !== undefined
                          ? `${row.result_value}${row.result_unit ? ` ${row.result_unit}` : ""}`
                          : null,
                      ].filter(Boolean).join(" · ")}
                    </span>
                    <span className="placementPoints">{row.points_awarded ?? 0} pts</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="placementUnavailable">This event has been declared. Placements are not available for public display.</div>
            )}
          </div>
        ) : (
          <div className="statusExplanation">
            {status === "pending"
              ? `${event.result_entries ?? 0} result entry${(event.result_entries ?? 0) === 1 ? "" : "ies"} recorded. Final placements are awaiting declaration.`
              : scheduleStamp(event.scheduled_date, event.start_time) !== null && (scheduleStamp(event.scheduled_date, event.start_time) as number) <= now
                ? "Scheduled slot has started. Results will appear after they are declared."
                : "This event is awaiting its scheduled time or a confirmed schedule."}
          </div>
        )}
      </article>
    );
  }

  return (
    <main className="publicResultsPage">
      <div className="publicResultsContainer">
        <header className="publicResultsHero">
          <div className="heroOrb heroOrbOne" />
          <div className="heroOrb heroOrbTwo" />
          <div className="publicResultsHeroContent">
            <div className="publicEyebrow"><Sparkles size={14} /> ESRA GLOBAL SCIENCE ACADEMY · 24–28 OCTOBER 2026</div>
            <h1>Official <span>Results</span></h1>
            <p>Celebrating achievement, effort and creativity at Sargamiya 2026.</p>
            <div className="publicHeroMeta">
              <span><CheckCircle2 size={14} /> {totalDeclared} declared</span>
              <span><Clock3 size={14} /> {totalPending} pending</span>
              <span><CalendarDays size={14} /> {totalToConduct} to be conducted</span>
            </div>
          </div>
          <div className="publicResultsHeroAction">
            <div className="heroTrophy"><Trophy size={36} /></div>
            <button type="button" className="publicRefreshButton" onClick={() => void loadData(true)} disabled={loading || refreshing}>
              <RefreshCw size={15} className={refreshing ? "spinning" : ""} /> Refresh Results
            </button>
            <span className="autoUpdateLabel">Auto-updates every 15 seconds</span>
          </div>
        </header>

        {error && (
          <div className="publicError"><AlertCircle size={18} /><div><strong>Results could not be loaded</strong><p>{error}</p><small>Confirm the public-results SQL migration has been run in Supabase.</small></div></div>
        )}

        <section className="studentStandingsSection">
          <div className="sectionTitleRow">
            <div><div className="sectionEyebrow">STUDENT LEADERBOARD</div><h2>Top Students by Category</h2><p>Ranked by points from officially declared individual events.</p></div>
            <div className="sectionIcon"><Users size={22} /></div>
          </div>
          <div className="categoryLeaderboardGrid">
            {studentStandings.map(({ category, students: topStudents }) => (
              <article className="categoryLeaderboardCard" key={category}>
                <div className="categoryLeaderboardHead"><h3>{category}</h3><span>{topStudents.length} ranked</span></div>
                {topStudents.length ? topStudents.map((student, index) => (
                  <div className={`studentStandingRow studentStanding-${index + 1}`} key={student.key}>
                    <div className="studentRank">{index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}</div>
                    <div className="studentIdentity"><strong>{student.name}</strong><span>{student.chestNo ? `Chest No. ${student.chestNo}` : student.house ?? "Student"}{student.house && student.chestNo ? ` · ${student.house}` : ""}</span></div>
                    <div className="studentScore"><strong>{student.points}</strong><span>PTS</span></div>
                  </div>
                )) : <div className="noStudentsYet">No declared individual results yet.</div>}
              </article>
            ))}
          </div>
        </section>

        <section className="publicEventResultsSection">
          <div className="sectionTitleRow">
            <div><div className="sectionEyebrow">EVENT STATUS</div><h2>Results & Event Progress</h2><p>Only declared placements are published in the event result cards.</p></div>
          </div>
          <div className="publicFilters">
            <label className="publicSearch"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search events, category, venue…" /></label>
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filter by category">
              <option value="all">All categories</option>
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="publicLoading"><RefreshCw className="spinning" size={20} /> Loading published results…</div>
          ) : (
            <div className="statusSections">
              <section className="statusGroup statusGroup-declared">
                <div className="statusGroupHeader"><div className="statusGroupIcon"><CheckCircle2 size={20} /></div><div><h3>Results Declared</h3><p>Finalised events and officially published placements.</p></div><span className="statusCount">{groups.declared.length}</span></div>
                {groups.declared.length ? <div className="publicEventGrid">{groups.declared.map((event) => renderStatusEvent(event, "declared"))}</div> : <div className="statusEmpty">No results have been declared for this selection yet.</div>}
              </section>
              <section className="statusGroup statusGroup-pending">
                <div className="statusGroupHeader"><div className="statusGroupIcon"><Clock3 size={20} /></div><div><h3>Results Pending</h3><p>Results entered or events ended, but results are not declared.</p></div><span className="statusCount">{groups.pending.length}</span></div>
                {groups.pending.length ? <div className="publicEventGrid">{groups.pending.map((event) => renderStatusEvent(event, "pending"))}</div> : <div className="statusEmpty">No pending results for this selection.</div>}
              </section>
              <section className="statusGroup statusGroup-conduct">
                <div className="statusGroupHeader"><div className="statusGroupIcon"><CalendarDays size={20} /></div><div><h3>Events to Be Conducted</h3><p>Upcoming, currently running or not-yet-scheduled events.</p></div><span className="statusCount">{groups.toConduct.length}</span></div>
                {groups.toConduct.length ? <div className="publicEventGrid">{groups.toConduct.map((event) => renderStatusEvent(event, "toConduct"))}</div> : <div className="statusEmpty">No events remain in this category.</div>}
              </section>
            </div>
          )}
        </section>

        <footer className="publicResultsFooter">
          <div><strong>SARGAMIYA 2026</strong><span>ESRA Global Science Academy</span></div>
          <div className="footerRight"><span>ART · CULTURE · CREATIVITY</span>{lastUpdated && <small>Updated {lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })}</small>}</div>
        </footer>
      </div>
      <style jsx global>{`
        .publicResultsPage{min-height:100vh;background:#f4f7fc;color:#132541;font-family:Geist,Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
        .publicResultsPage *{box-sizing:border-box}
        .publicResultsContainer{max-width:1500px;margin:0 auto;padding:30px 34px 44px}
        .publicResultsHero{position:relative;isolation:isolate;overflow:hidden;display:flex;align-items:center;justify-content:space-between;gap:28px;min-height:220px;padding:32px 38px;border-radius:24px;background:radial-gradient(circle at 82% 12%,rgba(116,74,255,.5),transparent 32%),radial-gradient(circle at 68% 100%,rgba(17,201,255,.24),transparent 36%),linear-gradient(112deg,#07162f 0%,#0b2650 54%,#241a55 100%);color:#fff;box-shadow:0 18px 46px rgba(7,22,47,.18)}
        .heroOrb{position:absolute;z-index:-1;border:1px solid rgba(255,255,255,.12);border-radius:50%;pointer-events:none}.heroOrbOne{width:350px;height:350px;right:14%;top:-210px}.heroOrbTwo{width:230px;height:230px;right:10%;bottom:-175px}
        .publicResultsHeroContent{min-width:0}.publicEyebrow{display:flex;align-items:center;gap:8px;color:#91e7ff;font-size:10px;letter-spacing:.16em;font-weight:850;text-transform:uppercase}.publicResultsHero h1{margin:13px 0 8px;font-size:clamp(36px,4vw,56px);line-height:.98;letter-spacing:-.055em;font-weight:950}.publicResultsHero h1 span{color:#45ddff}.publicResultsHero p{margin:0;color:#bdcce6;font-size:14px;line-height:1.6}.publicHeroMeta{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}.publicHeroMeta span{display:inline-flex;align-items:center;gap:7px;padding:8px 11px;border:1px solid rgba(255,255,255,.14);border-radius:999px;background:rgba(255,255,255,.06);color:#edf6ff;font-size:11px;font-weight:750}
        .publicResultsHeroAction{display:flex;flex-direction:column;align-items:center;gap:10px;flex:0 0 180px}.heroTrophy{width:76px;height:76px;display:grid;place-items:center;border-radius:24px;color:#ffe08a;background:linear-gradient(145deg,rgba(255,221,127,.2),rgba(255,255,255,.04));border:1px solid rgba(255,223,137,.3);box-shadow:0 10px 32px rgba(0,0,0,.18)}.publicRefreshButton{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:38px;padding:0 13px;border:1px solid rgba(255,255,255,.22);border-radius:11px;background:rgba(255,255,255,.09);color:#fff;font-size:11px;font-weight:800;cursor:pointer}.publicRefreshButton:disabled{opacity:.65;cursor:default}.autoUpdateLabel{font-size:10px;color:#9eb6d8;text-align:center}
        .publicError{display:flex;gap:12px;align-items:flex-start;margin:18px 0;padding:16px;border:1px solid #f0c5c5;border-radius:14px;background:#fff3f3;color:#9d2e38}.publicError p{margin:4px 0;font-size:13px}.publicError small{color:#83535a}
        .studentStandingsSection,.publicEventResultsSection{margin-top:34px}.sectionTitleRow{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:16px}.sectionEyebrow{margin-bottom:5px;color:#7b8ba3;font-size:10px;font-weight:900;letter-spacing:.15em}.sectionTitleRow h2{margin:0;color:#102341;font-size:clamp(22px,2vw,29px);letter-spacing:-.035em;font-weight:900}.sectionTitleRow p{margin:7px 0 0;color:#6e7f98;font-size:12px;line-height:1.5}.sectionIcon{width:48px;height:48px;display:grid;place-items:center;border:1px solid #dbe6f4;border-radius:15px;background:#fff;color:#286be7}
        .categoryLeaderboardGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.categoryLeaderboardCard{min-width:0;padding:16px;border:1px solid #dfe7f1;border-radius:16px;background:#fff;box-shadow:0 7px 22px rgba(18,44,82,.035)}.categoryLeaderboardHead{display:flex;align-items:center;justify-content:space-between;gap:8px;padding-bottom:12px;border-bottom:1px solid #edf1f6}.categoryLeaderboardHead h3{margin:0;color:#1c3355;font-size:13px;font-weight:900}.categoryLeaderboardHead span{flex:0 0 auto;color:#8b99ad;font-size:9px;font-weight:800}.studentStandingRow{display:flex;align-items:center;gap:9px;padding:12px 0;border-bottom:1px solid #f0f3f8}.studentStandingRow:last-child{border-bottom:0;padding-bottom:2px}.studentRank{width:28px;height:28px;flex:0 0 28px;display:grid;place-items:center;border-radius:9px;background:#f6f8fb;font-size:15px}.studentStanding-1 .studentRank{background:#fff5d8}.studentStanding-2 .studentRank{background:#f1f4f8}.studentStanding-3 .studentRank{background:#fff0e3}.studentIdentity{min-width:0;display:flex;flex-direction:column;gap:4px;flex:1}.studentIdentity strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#203652;font-size:11px;font-weight:850}.studentIdentity span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#8795a8;font-size:9px}.studentScore{display:flex;align-items:flex-end;flex-direction:column;gap:1px;color:#1c67d9}.studentScore strong{font-size:17px;line-height:1;font-weight:950}.studentScore span{font-size:8px;font-weight:850;letter-spacing:.08em}.noStudentsYet{padding:18px 2px 3px;color:#8a98ac;font-size:11px;line-height:1.5}
        .publicFilters{display:flex;gap:10px;margin:18px 0 20px}.publicSearch{flex:1;display:flex;align-items:center;gap:9px;min-width:0;padding:0 12px;border:1px solid #dbe4ef;border-radius:11px;background:#fff;color:#8a99af}.publicSearch input{width:100%;height:42px;border:0;outline:none;background:transparent;color:#19304e;font-size:12px}.publicFilters select{min-width:190px;padding:0 12px;border:1px solid #dbe4ef;border-radius:11px;background:#fff;color:#28405f;font-size:12px;font-weight:700;outline:none}.statusSections{display:flex;flex-direction:column;gap:22px}.statusGroup{overflow:hidden;border:1px solid #dfe7f1;border-radius:18px;background:#fff;box-shadow:0 8px 24px rgba(19,45,83,.035)}.statusGroupHeader{display:flex;align-items:center;gap:12px;padding:18px 20px;border-bottom:1px solid #edf1f6;background:linear-gradient(90deg,#fbfdff,#fff)}.statusGroupIcon{width:42px;height:42px;flex:0 0 42px;display:grid;place-items:center;border-radius:13px}.statusGroup-declared .statusGroupIcon{background:#e9f8ef;color:#16834c}.statusGroup-pending .statusGroupIcon{background:#fff4e3;color:#b46c13}.statusGroup-conduct .statusGroupIcon{background:#eaf3ff;color:#2369c5}.statusGroupHeader h3{margin:0;color:#172f4f;font-size:16px;font-weight:900}.statusGroupHeader p{margin:4px 0 0;color:#75869e;font-size:11px;line-height:1.45}.statusCount{display:grid;place-items:center;min-width:32px;height:32px;margin-left:auto;padding:0 8px;border:1px solid #e0e8f2;border-radius:10px;background:#fff;color:#425a79;font-size:12px;font-weight:900}
        .publicEventGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px;padding:15px}.publicEventCard{min-width:0;padding:16px;border:1px solid #e5ebf3;border-radius:14px;background:#fff}.publicEvent-toConduct,.publicEvent-pending{background:linear-gradient(180deg,#fff,#fcfdff)}.publicEventTopline{display:flex;align-items:center;justify-content:space-between;gap:8px}.categoryTag{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:60%;padding:5px 8px;border-radius:7px;background:#eff4fb;color:#4f6788;font-size:9px;font-weight:850}.statusPill{padding:5px 8px;border-radius:999px;font-size:9px;font-weight:900;white-space:nowrap}.statusPill-declared{background:#eaf8ef;color:#18834e}.statusPill-pending{background:#fff4e2;color:#a9620a}.statusPill-toConduct{background:#eaf3ff;color:#2564b8}.publicEventCard h3{margin:14px 0 4px;color:#183251;font-size:16px;line-height:1.25;font-weight:900}.eventDiscipline{margin:0;color:#7a8aa1;font-size:11px}.scheduleMeta{display:flex;align-items:center;gap:6px;margin-top:11px;color:#657a96;font-size:10px;line-height:1.4;flex-wrap:wrap}.scheduleMeta svg{flex:0 0 auto;color:#8197b3}.placementsBlock{margin-top:15px;padding-top:12px;border-top:1px solid #edf1f6}.placementsCaption{display:flex;align-items:center;gap:7px;margin-bottom:8px;color:#8796aa;font-size:9px;font-weight:900;letter-spacing:.1em}.placementsCaption svg{color:#d39b23}.placementList{display:flex;flex-direction:column}.placementRow{display:grid;grid-template-columns:22px 34px minmax(0,1fr) auto;align-items:center;gap:6px;padding:9px 0;border-bottom:1px solid #f1f4f8}.placementRow:last-child{border-bottom:0}.placementMedal{font-size:16px}.placementPosition{color:#61758f;font-size:9px;font-weight:900}.placementName{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#1b3352;font-size:11px;font-weight:850}.placementMetadata{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#8b98aa;font-size:9px}.placementPoints{color:#3473d9;font-size:10px;font-weight:900;white-space:nowrap}.placementUnavailable{padding:10px;border-radius:9px;background:#f7f9fc;color:#8795a8;font-size:10px;line-height:1.55}.statusExplanation{margin-top:15px;padding:12px;border:1px dashed #dfe6ef;border-radius:10px;background:#f8fafd;color:#7789a2;font-size:11px;line-height:1.55}.statusEmpty{padding:24px;text-align:center;color:#8998ad;font-size:12px;line-height:1.6}.publicLoading{display:flex;align-items:center;justify-content:center;gap:10px;padding:44px;color:#607793;font-size:12px}
        .publicResultsFooter{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-top:36px;padding:20px 4px 0;border-top:1px solid #dfe7f1}.publicResultsFooter>div{display:flex;flex-direction:column;gap:4px}.publicResultsFooter strong{color:#2b4160;font-size:11px;font-weight:950;letter-spacing:.1em}.publicResultsFooter span{color:#8492a6;font-size:10px}.footerRight{text-align:right;align-items:flex-end}.footerRight span{font-weight:850;letter-spacing:.12em}.footerRight small{color:#a0acbb;font-size:9px}.spinning{animation:publicSpin 1s linear infinite}@keyframes publicSpin{to{transform:rotate(360deg)}}
        @media(max-width:1120px){.categoryLeaderboardGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.publicResultsContainer{padding:24px}.publicResultsHero{padding:28px}}
        @media(max-width:760px){.publicResultsHero{align-items:flex-start;flex-direction:column;gap:20px}.publicResultsHeroAction{align-items:flex-start;flex-direction:row;flex-wrap:wrap;flex:initial}.heroTrophy{display:none}.autoUpdateLabel{align-self:center}.publicEventGrid{grid-template-columns:1fr}.publicFilters{flex-direction:column}.publicFilters select{height:42px}.publicResultsFooter{align-items:flex-start;flex-direction:column}.footerRight{align-items:flex-start;text-align:left}}
        @media(max-width:500px){.publicResultsContainer{padding:13px}.publicResultsHero{min-height:0;padding:24px 20px;border-radius:18px}.publicEyebrow{font-size:8px;letter-spacing:.08em}.publicHeroMeta{gap:7px}.publicHeroMeta span{padding:7px 9px;font-size:9px}.categoryLeaderboardGrid{grid-template-columns:1fr}.statusGroupHeader{padding:14px}.publicEventGrid{padding:10px}.sectionTitleRow h2{font-size:22px}}
      `}</style>
    </main>
  );
}
