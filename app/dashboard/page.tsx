"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Activity, Award, Clock3, Medal, RefreshCw, Trophy, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type HouseRow = {
  house_id: string;
  house: "Atlas" | "Titan" | "Olympus";
  total_points: number;
  last_points_at: string | null;
};

type Summary = {
  active_students: number;
  total_events: number;
  completed_events: number;
  total_points: number;
  last_points_update: string | null;
};

const EMPTY_SUMMARY: Summary = {
  active_students: 0,
  total_events: 0,
  completed_events: 0,
  total_points: 0,
  last_points_update: null,
};

export default function LiveDashboardPage() {
  const supabase = useMemo(() => createClient(), []);
  const [houses, setHouses] = useState<HouseRow[]>([]);
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const loadDashboard = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");

    const [houseResult, summaryResult] = await Promise.all([
      supabase
        .from("athlon_public_house_tally")
        .select("house_id, house, total_points, last_points_at")
        .order("total_points", { ascending: false })
        .order("house_id"),
      supabase
        .from("athlon_public_dashboard_summary")
        .select("active_students, total_events, completed_events, total_points, last_points_update")
        .single(),
    ]);

    if (houseResult.error || summaryResult.error) {
      setError(houseResult.error?.message || summaryResult.error?.message || "Unable to load the live scoreboard.");
    } else {
      setHouses((houseResult.data ?? []) as HouseRow[]);
      setSummary((summaryResult.data ?? EMPTY_SUMMARY) as Summary);
      setLastRefresh(new Date());
    }

    setLoading(false);
    setRefreshing(false);
  }, [supabase]);

  useEffect(() => {
    loadDashboard();

    const interval = window.setInterval(() => loadDashboard(true), 5000);

    const channel = supabase
      .channel("athlon-live-house-points")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "house_points" },
        () => loadDashboard(true)
      )
      .subscribe();

    return () => {
      window.clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [loadDashboard, supabase]);

  const rankedHouses = houses.length
    ? houses
    : [
        { house_id: "atlas", house: "Atlas" as const, total_points: 0, last_points_at: null },
        { house_id: "titan", house: "Titan" as const, total_points: 0, last_points_at: null },
        { house_id: "olympus", house: "Olympus" as const, total_points: 0, last_points_at: null },
      ];

  const leader = rankedHouses[0];
  const maxPoints = Math.max(...rankedHouses.map((h) => h.total_points), 1);
  const updatedAt = summary.last_points_update
    ? new Date(summary.last_points_update)
    : lastRefresh;

  return (
    <main className="dashboardShell">
      <header className="dashboardTopbar">
        <div className="dashboardBrand">
          <Image src="/brand/esra-logo.png" alt="ESRA Global Science Academy" width={220} height={64} priority />
          <div className="dashboardDivider" />
          <Image src="/brand/sargamiya-logo-placeholder.png" alt="Sargamiya 2026 temporary wordmark" width={78} height={78} priority />
        </div>
        <div className="dashboardActions">
          <div className="liveIndicator"><span /> LIVE SCOREBOARD</div>
          <button className="dashboardRefresh" onClick={() => loadDashboard(true)} disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? "spin" : ""} /> Refresh
          </button>
          <Link href="/" className="dashboardHome">Management Home</Link>
        </div>
      </header>

      <section className="dashboardHero">
        <div>
          <div className="eyebrow dashboardEyebrow">SARGAMIYA 2026 · ANNUAL ARTS FEST</div>
          <h1>House Championship</h1>
          <p>Every performance counts. Follow Atlas, Titan and Olympus as they compete for the Sargamiya house championship.</p>
        </div>
        <div className="dashboardHeroTrophy"><Trophy size={76} /></div>
      </section>

      {error && <div className="dashboardError">{error}</div>}

      <section className="dashboardStats">
        <article><Users size={21} /><div><span>Active Students</span><strong>{summary.active_students}</strong></div></article>
        <article><Medal size={21} /><div><span>Events</span><strong>{summary.total_events}</strong></div></article>
        <article><Activity size={21} /><div><span>Completed Events</span><strong>{summary.completed_events}<small> / {summary.total_events}</small></strong></div></article>
        <article><Award size={21} /><div><span>Points Awarded</span><strong>{summary.total_points}</strong></div></article>
      </section>

      <section className="championshipBoard">
        <div className="boardHeader">
          <div>
            <div className="eyebrow">CURRENT STANDINGS</div>
            <h2>Live Points Tally</h2>
          </div>
          <div className="boardUpdated"><Clock3 size={15} /> {updatedAt ? `Updated ${updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "Awaiting results"}</div>
        </div>

        {loading ? (
          <div className="dashboardLoading"><RefreshCw size={28} className="spin" /><span>Loading live standings…</span></div>
        ) : (
          <div className="standingsList">
            {rankedHouses.map((house, index) => {
              const width = Math.max((house.total_points / maxPoints) * 100, house.total_points ? 8 : 0);
              return (
                <article className={`standingRow ${index === 0 && house.total_points > 0 ? "leaderRow" : ""}`} key={house.house_id}>
                  <div className="rankNumber">{index + 1}</div>
                  <div className={`houseMark ${house.house.toLowerCase()}`}>{house.house.slice(0, 1)}</div>
                  <div className="standingMain">
                    <div className="standingTitle"><strong>{house.house}</strong>{index === 0 && house.total_points > 0 && <span className="leaderBadge">LEADER</span>}</div>
                    <div className="pointsBar"><span style={{ width: `${width}%` }} /></div>
                  </div>
                  <div className="standingPoints"><strong>{house.total_points}</strong><span>POINTS</span></div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="dashboardBottom">
        <div className="dashboardCallout">
          <div className="eyebrow">CURRENT LEADER</div>
          <strong>{leader?.total_points ? leader.house : "No points yet"}</strong>
          <span>{leader?.total_points ? `${leader.total_points} points` : "The championship begins with the first official result."}</span>
        </div>
        <div className="dashboardCallout">
          <div className="eyebrow">POINTING SYSTEM</div>
          <strong>5–3–1</strong>
          <span>Individual events</span>
        </div>
        <div className="dashboardCallout">
          <div className="eyebrow">GROUP EVENTS</div>
          <strong>10–6–4</strong>
          <span>House championship points</span>
        </div>
      </section>

      <footer className="dashboardFooter">
        <span>SARGAMIYA 2026 · ESRA Global Science Academy</span>
        <span>Live standings refresh automatically</span>
      </footer>
    </main>
  );
}
