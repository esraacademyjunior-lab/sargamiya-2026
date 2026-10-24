"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  CalendarDays,
  Clock3,
  Crown,
  Medal,
  RefreshCw,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type House = {
  id: string;
  name: string;
};

type HousePointRow = {
  id: string;
  house_id: string;
  event_id: string | null;
  result_id: string | null;
  points: number;
  reason: string;
  created_at: string;
};

type Event = {
  id: string;
  name: string;
  format: string;
  category: string;
};

type HouseStanding = {
  house: House;
  points: number;
  entries: number;
};

type RecentPoint = HousePointRow & {
  houseName: string;
  eventName: string;
};

const HOUSE_ORDER = ["Atlas", "Titan", "Olympus"];

export default function PointsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [houses, setHouses] = useState<House[]>([]);
  const [pointRows, setPointRows] = useState<HousePointRow[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [specialScores, setSpecialScores] = useState<Record<string, number>>({});
  const [specialSaving, setSpecialSaving] = useState(false);
  const [specialMessage, setSpecialMessage] = useState("");

  const loadData = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        setError("");

        const [housesResponse, pointsResponse, eventsResponse] =
          await Promise.all([
            supabase
              .from("houses")
              .select("id, name")
              .order("name"),

            supabase
              .from("house_points")
              .select(
                "id, house_id, event_id, result_id, points, reason, created_at"
              )
              .order("created_at", { ascending: false }),

            supabase
              .from("events")
              .select("id, name, format, category")
              .order("name"),
          ]);

        if (housesResponse.error) {
          throw new Error(housesResponse.error.message);
        }
        if (pointsResponse.error) {
          throw new Error(pointsResponse.error.message);
        }
        if (eventsResponse.error) {
          throw new Error(eventsResponse.error.message);
        }

        const loadedHouses = (housesResponse.data ?? []) as House[];
        loadedHouses.sort(
          (a, b) =>
            (HOUSE_ORDER.indexOf(a.name) === -1 ? 99 : HOUSE_ORDER.indexOf(a.name)) -
            (HOUSE_ORDER.indexOf(b.name) === -1 ? 99 : HOUSE_ORDER.indexOf(b.name))
        );

        setHouses(loadedHouses);
        const loadedPoints = (pointsResponse.data ?? []) as HousePointRow[];
        setPointRows(loadedPoints);
        setEvents((eventsResponse.data ?? []) as Event[]);

        const loadedSpecialScores = Object.fromEntries(
          loadedHouses.map((house) => {
            const row = loadedPoints.find(
              (point) => point.house_id === house.id && point.reason === "Special House Points"
            );
            return [house.id, Number(row?.points ?? 0)];
          })
        );
        setSpecialScores(loadedSpecialScores);
      } catch (err) {
        console.error("HOUSE POINTS LOAD ERROR:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load House Championship points."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const standings = useMemo<HouseStanding[]>(() => {
    const totals = new Map<string, number>();
    const counts = new Map<string, number>();

    for (const house of houses) {
      totals.set(house.id, 0);
      counts.set(house.id, 0);
    }

    for (const row of pointRows) {
      totals.set(
        row.house_id,
        (totals.get(row.house_id) ?? 0) + Number(row.points || 0)
      );
      counts.set(row.house_id, (counts.get(row.house_id) ?? 0) + 1);
    }

    return houses
      .map((house) => ({
        house,
        points: totals.get(house.id) ?? 0,
        entries: counts.get(house.id) ?? 0,
      }))
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        const ai = HOUSE_ORDER.indexOf(a.house.name);
        const bi = HOUSE_ORDER.indexOf(b.house.name);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });
  }, [houses, pointRows]);

  const houseMap = useMemo(
    () => new Map(houses.map((house) => [house.id, house.name])),
    [houses]
  );

  const eventMap = useMemo(
    () => new Map(events.map((event) => [event.id, event])),
    [events]
  );

  const recentPoints = useMemo<RecentPoint[]>(
    () =>
      pointRows.slice(0, 10).map((row) => ({
        ...row,
        houseName: houseMap.get(row.house_id) ?? "Unknown House",
        eventName: row.reason === "Special House Points" ? "Special House Points" : eventMap.get(row.event_id ?? "")?.name ?? "Unknown Event"
      })),
    [pointRows, houseMap, eventMap]
  );

  const totalPoints = useMemo(
    () => pointRows.reduce((sum, row) => sum + Number(row.points || 0), 0),
    [pointRows]
  );

  const eventsWithPoints = useMemo(
    () => new Set(pointRows.filter((row) => row.event_id).map((row) => row.event_id)).size,
    [pointRows]
  );

  const leader = standings[0];

  async function saveSpecialPoints() {
    setSpecialSaving(true);
    setSpecialMessage("");
    setError("");
    try {
      for (const house of houses) {
        const score = Number(specialScores[house.id] ?? 0);
        if (!Number.isInteger(score) || score < 0 || score > 30) {
          throw new Error(`${house.name} Special House Points mark must be a whole number from 0 to 30.`);
        }
      }

      const { error: deleteError } = await supabase
        .from("house_points")
        .delete()
        .eq("reason", "Special House Points");
      if (deleteError) throw new Error(deleteError.message);

      const rows = houses.map((house) => ({
        house_id: house.id,
        event_id: null,
        result_id: null,
        points: Number(specialScores[house.id] ?? 0),
        reason: "Special House Points",
      })).filter((row) => row.points > 0);

      if (rows.length) {
        const { error: insertError } = await supabase.from("house_points").insert(rows);
        if (insertError) throw new Error(insertError.message);
      }

      setSpecialMessage("Special House Points marks saved successfully. The marks have been added directly to House Points.");
      await loadData(true);
    } catch (err) {
      console.error("SPECIAL HOUSE POINTS SAVE ERROR:", err);
      setError(err instanceof Error ? err.message : "Unable to save Special House Points marks.");
    } finally {
      setSpecialSaving(false);
    }
  }

  function formatDate(value: string) {
    return new Date(value).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function formatTime(value: string) {
    return new Date(value).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <main className="pointsPage">
      <div className="pointsShell">
        <header className="pointsHeader">
          <div>
            <Link href="/admin" className="pointsBack">
              <ArrowLeft size={15} />
              Dashboard
            </Link>

            <div className="pointsEyebrow">
              SARGAMIYA 2026 / CHAMPIONSHIP
            </div>

            <h1>House Points</h1>

            <p>
              Live championship standings generated from official SARGAMIYA 2026
              results.
            </p>
          </div>

          <button
            type="button"
            className="pointsRefresh"
            onClick={() => void loadData(true)}
            disabled={refreshing}
          >
            <RefreshCw size={15} className={refreshing ? "pointsSpin" : ""} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </header>

        {error && (
          <div className="pointsAlert">
            <strong>Unable to load House Points.</strong>
            <span>{error}</span>
          </div>
        )}

        <section className="pointsSummary">
          <SummaryCard
            icon={<Trophy size={18} />}
            label="Current Leader"
            value={loading ? "—" : leader?.house.name ?? "—"}
            detail={
              loading
                ? "Loading standings"
                : `${leader?.points ?? 0} championship points`
            }
          />
          <SummaryCard
            icon={<Activity size={18} />}
            label="Total Points"
            value={loading ? "—" : String(totalPoints)}
            detail="Across all Houses"
          />
          <SummaryCard
            icon={<CalendarDays size={18} />}
            label="Scoring Events"
            value={loading ? "—" : String(eventsWithPoints)}
            detail={`of ${events.length} events`}
          />
          <SummaryCard
            icon={<BarChart3 size={18} />}
            label="Point Entries"
            value={loading ? "—" : String(pointRows.length)}
            detail="Generated from results"
          />
        </section>

        <section className="pointsSection" style={{ marginBottom: 24 }}>
          <div className="pointsSectionHead">
            <div>
              <div className="pointsLabel">MANUAL HOUSE SCORING</div>
              <h2>Special House Points</h2>
              <p style={{ margin: "6px 0 0", color: "#6b7d96", fontSize: 13 }}>
                Enter a bonus score out of 30 for each House. The score is added directly to the House total.
              </p>
            </div>
            <button type="button" className="pointsRefresh" onClick={() => void saveSpecialPoints()} disabled={specialSaving || loading}>
              {specialSaving ? "Saving…" : "Save Special House Points"}
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
            {houses.map((house) => (
              <label key={house.id} style={{ display: "flex", flexDirection: "column", gap: 7, padding: 16, border: "1px solid #e1e7ef", borderRadius: 14, background: "#fff" }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#667892" }}>{house.name}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="number" min={0} max={30} step={1}
                    value={specialScores[house.id] ?? 0}
                    onChange={(event) => setSpecialScores((current) => ({ ...current, [house.id]: Number(event.target.value) }))}
                    style={{ width: "100%", minHeight: 42, padding: "0 12px", border: "1px solid #d8e0ea", borderRadius: 10, fontSize: 18, fontWeight: 800 }}
                  />
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#8391a5" }}>/ 30</span>
                </div>
              </label>
            ))}
          </div>
          {specialMessage ? <div style={{ marginTop: 12, color: "#13795b", fontSize: 12, fontWeight: 700 }}>{specialMessage}</div> : null}
        </section>

        <section className="pointsSection">
          <div className="pointsSectionHead">
            <div>
              <div className="pointsLabel">LIVE STANDINGS</div>
              <h2>House Championship</h2>
            </div>
            <div className="pointsLiveNote">
              <span />
              Automatically updated from results
            </div>
          </div>

          <div className="standingsGrid">
            {loading ? (
              <LoadingRows count={3} />
            ) : standings.length === 0 ? (
              <EmptyState
                icon={<Trophy size={22} />}
                title="No House standings yet"
                description="Official results will appear here once championship points are awarded."
              />
            ) : (
              standings.map((standing, index) => {
                const rank = index + 1;
                const isLeader = rank === 1;

                return (
                  <article
                    key={standing.house.id}
                    className={`standingCard ${isLeader ? "standingLeader" : ""}`}
                  >
                    <div className="standingRank">
                      {rank === 1 ? (
                        <Crown size={17} />
                      ) : rank <= 3 ? (
                        <Medal size={17} />
                      ) : (
                        rank
                      )}
                    </div>

                    <div className="houseMark">
                      {standing.house.name.charAt(0)}
                    </div>

                    <div className="standingInfo">
                      <div className="standingName">
                        {standing.house.name}
                        {isLeader && <span>Leader</span>}
                      </div>
                      <div className="standingMeta">
                        {standing.entries}{" "}
                        {standing.entries === 1 ? "scoring entry" : "scoring entries"}
                      </div>
                    </div>

                    <div className="standingScore">
                      <strong>{standing.points}</strong>
                      <small>POINTS</small>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>

        <section className="pointsLowerGrid">
          <div className="pointsCard">
            <div className="pointsCardHead">
              <div className="pointsIcon">
                <Zap size={17} />
              </div>
              <div>
                <h2>Pointing System</h2>
                <p>Official SARGAMIYA 2026 allocation</p>
              </div>
            </div>

            <div className="pointingGrid">
              <PointingColumn
                title="Individual"
                values={[
                  ["1st", "5"],
                  ["2nd", "3"],
                  ["3rd", "1"],
                ]}
              />
              <PointingColumn
                title="Group"
                values={[
                  ["1st", "10"],
                  ["2nd", "6"],
                  ["3rd", "4"],
                ]}
              />
              <PointingColumn
                title="Team"
                values={[
                  ["1st", "10"],
                  ["2nd", "6"],
                  ["3rd", "4"],
                ]}
              />
            </div>

            <Link href="/admin/points" className="pointsGuideLink">
              View full pointing guide →
            </Link>
          </div>

          <div className="pointsCard">
            <div className="pointsCardHead">
              <div className="pointsIcon">
                <Clock3 size={17} />
              </div>
              <div>
                <h2>Recent Points</h2>
                <p>Latest championship entries</p>
              </div>
            </div>

            {loading ? (
              <LoadingRows count={4} />
            ) : recentPoints.length === 0 ? (
              <EmptyState
                icon={<Activity size={22} />}
                title="No points awarded"
                description="Points will appear here after official results are entered."
              />
            ) : (
              <div className="recentList">
                {recentPoints.map((row) => (
                  <div className="recentRow" key={row.id}>
                    <div className="recentHouse">
                      {row.houseName.charAt(0)}
                    </div>
                    <div className="recentInfo">
                      <strong>{row.houseName}</strong>
                      <span>{row.eventName}</span>
                      {row.reason && <em>{row.reason}</em>}
                    </div>
                    <div className="recentScore">
                      <strong>+{row.points}</strong>
                      <span>
                        {formatDate(row.created_at)} ·{" "}
                        {formatTime(row.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="automationCard">
          <div className="automationIcon">
            <Users size={18} />
          </div>
          <div>
            <h2>Automated Championship Scoring</h2>
            <p>
              House points are generated automatically when official SARGAMIYA
              2026 results are recorded. This page reads the resulting
              House-point ledger and does not manually recalculate or override
              championship scores.
            </p>
          </div>
          <button
            type="button"
            className="automationRefresh"
            onClick={() => void loadData(true)}
            disabled={refreshing}
          >
            <RefreshCw size={14} />
            Refresh Standings
          </button>
        </section>
      </div>
    </main>
  );
}

function SummaryCard({
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
    <article className="summaryCard">
      <div className="summaryTop">
        <div className="summaryIcon">{icon}</div>
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function PointingColumn({
  title,
  values,
}: {
  title: string;
  values: string[][];
}) {
  return (
    <div className="pointingColumn">
      <strong>{title}</strong>
      {values.map(([place, points]) => (
        <div key={place} className="pointingRow">
          <span>{place}</span>
          <b>{points}</b>
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="emptyState">
      <div>{icon}</div>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function LoadingRows({ count }: { count: number }) {
  return (
    <div className="loadingRows">
      {Array.from({ length: count }).map((_, index) => (
        <div className="loadingRow" key={index}>
          <span />
          <div>
            <i />
            <b />
          </div>
          <em />
        </div>
      ))}
    </div>
  );
}
