"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, Medal, RefreshCw, Search, Trophy, Users, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type HouseCategory = { house_id: string; house: string; category: string; points: number; events_scored: number };
type MedalRow = { house_id: string; house: string; gold: number; silver: number; bronze: number; total_medals: number; points: number };
type Student = { student_id: string; chest_no: number; student_name: string; class_name: string; division: string | null; category: string; house: string; official_events: number; gold: number; silver: number; bronze: number; points: number };
type EventResult = { id: string; event_id: string; category: string; discipline: string; event_name: string; event_format: string; position: number; result_value: number | null; result_unit: string | null; student_name: string | null; chest_no: number | null; class_name: string | null; team_name: string | null; house: string | null; points_awarded: number };

const categories = ["All", "Junior Boys", "Junior Girls", "Senior Boys", "Senior Girls"];
const houses = ["All", "Atlas", "Titan", "Olympus"];

export default function AnalyticsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [category, setCategory] = useState("All");
  const [house, setHouse] = useState("All");
  const [tab, setTab] = useState<"overview" | "events" | "students">("overview");
  const [houseCategory, setHouseCategory] = useState<HouseCategory[]>([]);
  const [medals, setMedals] = useState<MedalRow[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [results, setResults] = useState<EventResult[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const [hc, md, st, rs] = await Promise.all([
      supabase.from("athlon_analytics_house_category").select("house_id,house,category,points,events_scored"),
      supabase.from("athlon_analytics_house_medals").select("house_id,house,gold,silver,bronze,total_medals,points").order("points", { ascending: false }),
      supabase.from("athlon_analytics_student_performance").select("student_id,chest_no,student_name,class_name,division,category,house,official_events,gold,silver,bronze,points").order("points", { ascending: false }),
      supabase.from("athlon_analytics_event_results").select("id,event_id,category,discipline,event_name,event_format,position,result_value,result_unit,student_name,chest_no,class_name,team_name,house,points_awarded").order("position", { ascending: true }),
    ]);
    const firstError = hc.error || md.error || st.error || rs.error;
    if (firstError) setError(firstError.message);
    else { setHouseCategory((hc.data ?? []) as HouseCategory[]); setMedals((md.data ?? []) as MedalRow[]); setStudents((st.data ?? []) as Student[]); setResults((rs.data ?? []) as EventResult[]); }
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const filteredStudents = students.filter(s => (category === "All" || s.category === category) && (house === "All" || s.house === house) && (!search || s.student_name.toLowerCase().includes(search.toLowerCase()) || String(s.chest_no).includes(search)));
  const filteredResults = results.filter(r => (category === "All" || r.category === category) && (house === "All" || r.house === house) && (!search || (r.event_name + " " + (r.student_name ?? "") + " " + (r.house ?? "")).toLowerCase().includes(search.toLowerCase())));
  const categoryRows = houseCategory.filter(r => category === "All" || r.category === category).filter(r => house === "All" || r.house === house);
  const pivot = ["Atlas", "Titan", "Olympus"].map(h => ({ house: h, rows: categoryRows.filter(r => r.house === h), total: medals.find(m => m.house === h)?.points ?? 0 }));
  const leader = [...medals].sort((a,b) => b.points - a.points)[0];

  return <main className="adminPage analyticsPage">
    <header className="pageHeader">
      <div><div className="eyebrow">SARGAMIYA 2026 · CHAMPIONSHIP CONTROL</div><h1>Championship Analytics</h1><p>Event results, House performance, medals and student achievements.</p></div>
      <div className="headerActions"><Link href="/dashboard" className="secondaryButton">Live Scoreboard</Link><button className="secondaryButton" onClick={load} disabled={loading}><RefreshCw size={15} className={loading ? "spin" : ""}/> Refresh</button></div>
    </header>

    {error && <div className="dashboardError">{error}<div style={{marginTop:6,fontSize:12}}>Run <strong>supabase/analytics.sql</strong> in Supabase SQL Editor if these analytics views have not been created yet.</div></div>}

    <section className="analyticsHero">
      <div><span className="eyebrow">CURRENT CHAMPIONSHIP LEADER</span><strong>{leader?.house ?? "Awaiting results"}</strong><span>{leader ? `${leader.points} points · ${leader.gold} gold · ${leader.silver} silver · ${leader.bronze} bronze` : "Official results will appear here."}</span></div>
      <Trophy size={58}/>
    </section>

    <section className="analyticsFilters">
      <label>Category<select value={category} onChange={e => setCategory(e.target.value)}>{categories.map(x => <option key={x}>{x}</option>)}</select></label>
      <label>House<select value={house} onChange={e => setHouse(e.target.value)}>{houses.map(x => <option key={x}>{x}</option>)}</select></label>
      <label className="analyticsSearch"><span>Search</span><div><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder={tab === "students" ? "Name or chest number" : "Event, student or house"}/>{search && <button onClick={() => setSearch("")}><X size={15}/></button>}</div></label>
    </section>

    <nav className="analyticsTabs"><button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}><BarChart3 size={16}/> House Performance</button><button className={tab === "events" ? "active" : ""} onClick={() => setTab("events")}><Medal size={16}/> Event Results</button><button className={tab === "students" ? "active" : ""} onClick={() => setTab("students")}><Users size={16}/> Student Performance</button></nav>

    {loading ? <div className="analyticsLoading"><RefreshCw size={25} className="spin"/> Loading analytics…</div> : tab === "overview" ? <>
      <section className="analyticsGrid">
        {pivot.map(p => <article className="analyticsHouseCard" key={p.house}><div className="analyticsHouseTitle"><span className={`analyticsHouseMark ${p.house.toLowerCase()}`}>{p.house[0]}</span><div><strong>{p.house}</strong><small>{p.total} total points</small></div></div>{["Junior Boys","Junior Girls","Senior Boys","Senior Girls"].map(c => { const row = p.rows.find(r => r.category === c); return <div className="categoryMetric" key={c}><span>{c}</span><strong>{row?.points ?? 0}</strong><small>{row?.events_scored ?? 0} events</small></div>; })}</article>)}
      </section>
      <section className="analyticsTableCard"><div className="sectionTitle"><div><div className="eyebrow">MEDAL TABLE</div><h2>House Medals</h2></div></div><div className="tableScroll"><table><thead><tr><th>House</th><th>Gold</th><th>Silver</th><th>Bronze</th><th>Total</th><th>Points</th></tr></thead><tbody>{medals.map(m => <tr key={m.house}><td><strong>{m.house}</strong></td><td>{m.gold}</td><td>{m.silver}</td><td>{m.bronze}</td><td><strong>{m.total_medals}</strong></td><td><strong>{m.points}</strong></td></tr>)}</tbody></table></div></section>
    </> : tab === "events" ? <section className="analyticsTableCard"><div className="sectionTitle"><div><div className="eyebrow">OFFICIAL RESULTS</div><h2>Event-wise Results</h2></div><span>{filteredResults.length} results</span></div><div className="tableScroll"><table><thead><tr><th>Event</th><th>Category</th><th>Position</th><th>Participant</th><th>House</th><th>Result</th><th>Points</th></tr></thead><tbody>{filteredResults.map(r => <tr key={r.id}><td><strong>{r.event_name}</strong><small className="tableSub">{r.discipline}</small></td><td>{r.category}</td><td><strong>{r.position}</strong></td><td>{r.team_name ?? r.student_name}<small className="tableSub">{r.chest_no ? `Chest ${r.chest_no}` : r.event_format}</small></td><td>{r.house ?? "—"}</td><td>{r.result_value ?? "—"} {r.result_unit ?? ""}</td><td><strong>{r.points_awarded}</strong></td></tr>)}</tbody></table></div></section> : <section className="analyticsTableCard"><div className="sectionTitle"><div><div className="eyebrow">OFFICIAL PERFORMANCE</div><h2>Student Performance</h2></div><span>{filteredStudents.length} students</span></div><div className="tableScroll"><table><thead><tr><th>Rank</th><th>Student</th><th>Category</th><th>House</th><th>Events</th><th>Gold</th><th>Silver</th><th>Bronze</th><th>Points</th></tr></thead><tbody>{filteredStudents.map((s,i) => <tr key={s.student_id}><td><strong>{i+1}</strong></td><td><strong>{s.student_name}</strong><small className="tableSub">Chest {s.chest_no} · {s.class_name}{s.division ? ` ${s.division}` : ""}</small></td><td>{s.category}</td><td>{s.house}</td><td>{s.official_events}</td><td>{s.gold}</td><td>{s.silver}</td><td>{s.bronze}</td><td><strong>{s.points}</strong></td></tr>)}</tbody></table></div></section>}

    <footer className="analyticsFooter">SARGAMIYA 2026 · ESRA Global Science Academy · Official results only</footer>
  </main>;
}
