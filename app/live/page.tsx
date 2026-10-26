"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  CircleDot,
  Clock3,
  MapPin,
  Music2,
  BookOpen,
  Camera,
  Images,
  Palette,
  PenTool,
  Landmark,
  Medal,
  Mountain,
  ShieldCheck,
  Sparkles,
  Timer,
  Trophy,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type HouseTally = {
  house_id: string;
  house: string;
  total_points: number;
};

type ScoreboardHouse = {
  house_id: string;
  house: string;
  total_points: number;
  hasTally: boolean;
};

type ScheduleSlot = {
  schedule_id: string;
  event_id: string;
  category: string | null;
  event_name: string;
  discipline: string | null;
  format: string | null;
  scheduled_date: string | null;
  start_time: string | null;
  end_time: string | null;
  venue: string | null;
  notes: string | null;
};

type PublicResult = {
  result_id: string;
  event_id: string;
  category: string | null;
  discipline: string | null;
  event_name: string;
  event_format: string | null;
  position: number | null;
  result_value: number | string | null;
  result_unit: string | null;
  points_awarded: number | null;
  participant_name: string | null;
  chest_no: number | null;
  house: string | null;
  updated_at: string | null;
};

type LiveHighlight = {
  id: string;
  title: string | null;
  event_name: string | null;
  photo_url: string;
  created_at: string | null;
};

type LatestEventResults = {
  eventId: string;
  eventName: string;
  category: string | null;
  discipline: string | null;
  eventFormat: string | null;
  updatedAt: string | null;
  placements: PublicResult[];
};

const HOUSE_ORDER = ["Atlas", "Olympus", "Titan"] as const;

function houseClass(name: string) {
  const key = name.toLowerCase();
  if (key.includes("atlas")) return "atlas";
  if (key.includes("titan")) return "titan";
  if (key.includes("olympus")) return "olympus";
  return "other";
}

function houseLabel(name: string) {
  const key = name.toLowerCase();
  if (key.includes("atlas")) return "BLUE HOUSE";
  if (key.includes("titan")) return "WHITE HOUSE";
  if (key.includes("olympus")) return "RED HOUSE";
  return "HOUSE";
}

function HouseCrest({ house }: { house: string }) {
  const key = houseClass(house);
  const Icon = key === "atlas" ? Mountain : key === "olympus" ? Landmark : ShieldCheck;
  return (
    <div className={`scoreboardCrest scoreboardCrest-${key}`} aria-hidden="true">
      <Icon strokeWidth={1.65} />
    </div>
  );
}

function rankLabel(rank: number) {
  if (rank === 1) return "1st";
  if (rank === 2) return "2nd";
  if (rank === 3) return "3rd";
  return `${rank}th`;
}

function timeLabel(timestamp: number) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(timestamp));
}

function scheduleTimestamp(date: string | null, time: string | null) {
  if (!date || !time) return null;
  const parsed = Date.parse(`${date}T${time.slice(0, 8)}+05:30`);
  return Number.isFinite(parsed) ? parsed : null;
}

function scheduleTimeLabel(value: string | null) {
  if (!value) return "TIME TBA";
  const [rawHour, rawMinute] = value.slice(0, 5).split(":").map(Number);
  if (!Number.isFinite(rawHour) || !Number.isFinite(rawMinute)) return "TIME TBA";
  const hour = rawHour % 12 || 12;
  return `${hour}:${String(rawMinute).padStart(2, "0")} ${rawHour >= 12 ? "PM" : "AM"}`;
}

function scheduleDateLabel(value: string | null, options: Intl.DateTimeFormatOptions = { weekday: "short", day: "2-digit", month: "short" }) {
  if (!value) return "DATE TBA";
  const parsed = new Date(`${value}T12:00:00+05:30`);
  if (!Number.isFinite(parsed.getTime())) return "DATE TBA";
  return new Intl.DateTimeFormat("en-IN", { ...options, timeZone: "Asia/Kolkata" }).format(parsed).toUpperCase();
}

function resultPublishedLabel(value: string | null) {
  if (!value) return "OFFICIAL RESULTS";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "OFFICIAL RESULTS";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(parsed).toUpperCase();
}

function highlightPublishedLabel(value: string | null) {
  if (!value) return "SARGAMIYA 2026";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "SARGAMIYA 2026";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(parsed).toUpperCase();
}

function positionLabel(position: number | null) {
  if (!position || position < 1) return "PLACED";
  return rankLabel(position);
}

function resultMetric(value: number | string | null, unit: string | null) {
  if (value === null || value === "") return null;
  return `${value}${unit ? ` ${unit}` : ""}`;
}

function countdownLabel(milliseconds: number | null) {
  if (milliseconds === null) return "TIME TBA";
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (days) return `${days}D ${String(hours).padStart(2, "0")}H`;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function visualForEvent(name: string) {
  const key = name.toLowerCase();
  if (/drawing|colour|color|painting|calligraphy|craft|art/.test(key)) return { Icon: Palette, kind: "visual" };
  if (/music|song|mappila|burda|instrument|singing/.test(key)) return { Icon: Music2, kind: "music" };
  if (/story|writing|essay|poem|speech|elocution|report/.test(key)) return { Icon: PenTool, kind: "writing" };
  return { Icon: BookOpen, kind: "stage" };
}

function sortSchedule(rows: ScheduleSlot[]) {
  return [...rows].sort((a, b) => {
    const left = scheduleTimestamp(a.scheduled_date, a.start_time) ?? Number.POSITIVE_INFINITY;
    const right = scheduleTimestamp(b.scheduled_date, b.start_time) ?? Number.POSITIVE_INFINITY;
    return left - right;
  });
}

export default function LivePage() {
  const supabase = useMemo(() => createClient(), []);
  const [houses, setHouses] = useState<HouseTally[]>([]);
  const [scheduleRows, setScheduleRows] = useState<ScheduleSlot[]>([]);
  const [resultRows, setResultRows] = useState<PublicResult[]>([]);
  const [resultLoadState, setResultLoadState] = useState<"loading" | "live" | "empty" | "error">("loading");
  const [highlightRows, setHighlightRows] = useState<LiveHighlight[]>([]);
  const [highlightLoadState, setHighlightLoadState] = useState<"loading" | "live" | "empty" | "error">("loading");
  const [highlightTotalCount, setHighlightTotalCount] = useState(0);
  const [slideIndex, setSlideIndex] = useState(0);
  const scheduleScrollPositions = useRef<Record<string, number>>({ ongoing: 0, next: 0, finished: 0 });
  const [now, setNow] = useState(() => Date.now());
  const [dataState, setDataState] = useState<"loading" | "live" | "stale">("loading");
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const loadHousePoints = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("athlon_public_house_tally")
        .select("house_id,house,total_points")
        .order("total_points", { ascending: false });

      if (error) throw error;
      setHouses((data ?? []) as HouseTally[]);
      setDataState("live");
      setLastUpdated(Date.now());
    } catch {
      setDataState("stale");
    }
  }, [supabase]);

  const loadSchedule = useCallback(async () => {
    const { data, error } = await supabase
      .from("athlon_public_schedule")
      .select("schedule_id,event_id,category,event_name,discipline,format,scheduled_date,start_time,end_time,venue,notes")
      .order("scheduled_date", { ascending: true, nullsFirst: false })
      .order("start_time", { ascending: true, nullsFirst: false });
    if (!error) setScheduleRows((data ?? []) as ScheduleSlot[]);
  }, [supabase]);

  const loadLatestResults = useCallback(async () => {
    const { data, error } = await supabase
      .from("athlon_public_results")
      .select("result_id,event_id,category,discipline,event_name,event_format,position,result_value,result_unit,points_awarded,participant_name,chest_no,house,updated_at")
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(250);

    if (error) {
      setResultLoadState("error");
      return;
    }

    const rows = (data ?? []) as PublicResult[];
    setResultRows(rows);
    setResultLoadState(rows.length ? "live" : "empty");
  }, [supabase]);

  const loadLiveHighlights = useCallback(async () => {
    const { data, error, count } = await supabase
      .from("live_highlights")
      .select("id,title,event_name,photo_url,created_at", { count: "exact" })
      .eq("is_published", true)
      .order("created_at", { ascending: false, nullsFirst: false })
      .limit(30);

    if (error) {
      setHighlightLoadState("error");
      return;
    }

    const rows = (data ?? []) as LiveHighlight[];
    setHighlightRows(rows);
    setHighlightTotalCount(count ?? rows.length);
    setHighlightLoadState(rows.length ? "live" : "empty");
  }, [supabase]);

  useEffect(() => {
    void loadHousePoints();
    void loadSchedule();
    void loadLatestResults();
    void loadLiveHighlights();
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    const refresh = window.setInterval(() => {
      void loadHousePoints();
      void loadSchedule();
      void loadLatestResults();
      void loadLiveHighlights();
    }, 15000);
    const slideTimer = window.setInterval(() => setSlideIndex((current) => (current + 1) % 4), 30000);
    const channel = supabase
      .channel("sargamiya-house-points-screen")
      .on("postgres_changes", { event: "*", schema: "public", table: "house_points" }, () => void loadHousePoints())
      .on("postgres_changes", { event: "*", schema: "public", table: "event_schedule" }, () => void loadSchedule())
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => void loadSchedule())
      .on("postgres_changes", { event: "*", schema: "public", table: "results" }, () => void loadLatestResults())
      .on("postgres_changes", { event: "*", schema: "public", table: "live_highlights" }, () => void loadLiveHighlights())
      .subscribe();

    return () => {
      window.clearInterval(clock);
      window.clearInterval(refresh);
      window.clearInterval(slideTimer);
      void supabase.removeChannel(channel);
    };
  }, [loadHousePoints, loadSchedule, loadLatestResults, loadLiveHighlights, supabase]);

  // On the TV schedule slide, independently scroll each status column so that
  // every published event can be seen without scrolling the full page.
  useEffect(() => {
    if (slideIndex !== 1) return;

    const lists = Array.from(document.querySelectorAll<HTMLElement>(".scheduleMultiList"));
    if (!lists.length) return;

    const startedAt = performance.now();
    const states = new Map<HTMLElement, { key: string; pauseUntil: number; resetAt: number }>();
    for (const list of lists) {
      const key = list.dataset.scrollKey ?? "ongoing";
      const maxScroll = Math.max(0, list.scrollHeight - list.clientHeight);
      list.scrollTop = Math.min(scheduleScrollPositions.current[key] ?? 0, maxScroll);
      states.set(list, { key, pauseUntil: startedAt + 900, resetAt: 0 });
    }
    let frame = 0;
    let previous = startedAt;

    const tick = (time: number) => {
      const delta = Math.min(50, Math.max(0, time - previous));
      previous = time;

      for (const list of lists) {
        const state = states.get(list);
        if (!state) continue;
        const maxScroll = list.scrollHeight - list.clientHeight;
        if (maxScroll <= 4) continue;

        if (state.resetAt > 0) {
          if (time >= state.resetAt) {
            list.scrollTop = 0;
            scheduleScrollPositions.current[state.key] = 0;
            state.resetAt = 0;
            state.pauseUntil = time + 1100;
          }
          continue;
        }
        if (time < state.pauseUntil) continue;

        if (list.scrollTop >= maxScroll - 2) {
          state.resetAt = time + 750;
          continue;
        }
        list.scrollTop = Math.min(maxScroll, list.scrollTop + delta * 0.018);
        scheduleScrollPositions.current[state.key] = list.scrollTop;
      }

      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => {
      for (const list of lists) {
        const key = list.dataset.scrollKey ?? "ongoing";
        scheduleScrollPositions.current[key] = list.scrollTop;
      }
      window.cancelAnimationFrame(frame);
    };
  }, [slideIndex, scheduleRows.length]);

  const displayHouses = useMemo<ScoreboardHouse[]>(() => {
    const getHouse = (canonicalName: string): ScoreboardHouse => {
      const found = houses.find((row) => row.house.toLowerCase().includes(canonicalName.toLowerCase()));
      return found
        ? { ...found, total_points: Number(found.total_points || 0), hasTally: true }
        : { house_id: `pending-${canonicalName.toLowerCase()}`, house: canonicalName, total_points: 0, hasTally: false };
    };

    const canonical = HOUSE_ORDER.map(getHouse);
    return canonical.sort((a, b) => {
      if (a.hasTally !== b.hasTally) return a.hasTally ? -1 : 1;
      return b.total_points - a.total_points;
    });
  }, [houses]);

  const anyPoints = displayHouses.some((house) => house.hasTally);
  const orderedSchedule = useMemo(() => sortSchedule(scheduleRows), [scheduleRows]);
  // The arts fest runs multiple competitions in parallel. Keep each status bucket
  // as a collection instead of selecting only the first matching schedule row.
  const ongoingEvents = useMemo(() => orderedSchedule.filter((slot) => {
    const start = scheduleTimestamp(slot.scheduled_date, slot.start_time);
    const end = scheduleTimestamp(slot.scheduled_date, slot.end_time);
    return start !== null && end !== null && now >= start && now < end;
  }), [orderedSchedule, now]);
  const upcomingEvents = useMemo(() => orderedSchedule.filter((slot) => {
    const start = scheduleTimestamp(slot.scheduled_date, slot.start_time);
    return start !== null && start > now;
  }), [orderedSchedule, now]);
  const recentlyFinishedEvents = useMemo(() => [...orderedSchedule].filter((slot) => {
    const end = scheduleTimestamp(slot.scheduled_date, slot.end_time);
    return end !== null && end <= now;
  }).sort((a, b) => (scheduleTimestamp(b.scheduled_date, b.end_time) ?? 0) - (scheduleTimestamp(a.scheduled_date, a.end_time) ?? 0)), [orderedSchedule, now]);
  const latestResultEvents = useMemo<LatestEventResults[]>(() => {
    const grouped = new Map<string, PublicResult[]>();
    for (const row of resultRows) {
      const key = row.event_id;
      const current = grouped.get(key) ?? [];
      current.push(row);
      grouped.set(key, current);
    }

    const events = Array.from(grouped.entries()).map(([eventId, rows]) => {
      const newestTimestamp = rows.reduce<string | null>((latest, row) => {
        if (!row.updated_at) return latest;
        if (!latest) return row.updated_at;
        return Date.parse(row.updated_at) > Date.parse(latest) ? row.updated_at : latest;
      }, null);
      const first = rows[0];
      const placements = rows
        .filter((row) => row.position !== null && row.position >= 1 && row.position <= 3)
        .sort((a, b) => (a.position ?? 99) - (b.position ?? 99) || Number(b.points_awarded ?? 0) - Number(a.points_awarded ?? 0))
        .slice(0, 3);
      return {
        eventId,
        eventName: first.event_name,
        category: first.category,
        discipline: first.discipline,
        eventFormat: first.event_format,
        updatedAt: newestTimestamp,
        placements,
      };
    });

    return events
      .sort((a, b) => (Date.parse(b.updatedAt ?? "") || 0) - (Date.parse(a.updatedAt ?? "") || 0))
      .slice(0, 3);
  }, [resultRows]);
  const todayLabel = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(now)).toUpperCase();

  if (slideIndex === 3) {
    const featuredPhotos = Array.from({ length: 5 }, (_, index) => highlightRows[index] ?? null);
    const emptyTitle = highlightLoadState === "error"
      ? "Highlights feed unavailable"
      : highlightLoadState === "loading"
        ? "Gathering festival moments"
        : "Festival highlights are on the way";
    const emptyText = highlightLoadState === "error"
      ? "Check that the live_highlights table and public read policy are configured."
      : highlightLoadState === "loading"
        ? "Approved photographs will appear here as the gallery loads."
        : "Approved event photographs will appear here as the media team publishes them.";

    return (
      <main className="liveHighlightsSlidePage" aria-label="Sargamiya 2026 festival photo highlights">
        <div className="scheduleSlideAtmosphere" aria-hidden="true" />
        <div className="scheduleSlideBeam scheduleSlideBeamOne" aria-hidden="true" />
        <div className="scheduleSlideBeam scheduleSlideBeamTwo" aria-hidden="true" />

        <header className="scheduleSlideHeader liveHighlightsHeader">
          <div className="scheduleSlideBrand">
            <img src="/brand/sargamiya-logo-transparent.png" alt="ESRA Sargamiya" />
            <span>2026 <small>ANNUAL ARTS FEST</small></span>
          </div>
          <div className="scheduleSlideTitleBlock">
            <h1><span>FESTIVAL</span> HIGHLIGHTS</h1>
            <div className="scheduleSlideTitleRule"><i /><b>✦</b><i /></div>
            <p>ART IN EVERY MOMENT <strong>· SARGAMIYA 2026</strong></p>
          </div>
          <div className="scheduleSlideDate liveHighlightsDate">
            <CalendarDays />
            <div><strong>24–28 OCT 2026</strong><span>ESRA CAMPUS</span><small><Clock3 /> {timeLabel(now)} <i /> LIVE PHOTO FEED</small></div>
          </div>
        </header>

        <div className="liveHighlightsIntro">
          <div className="liveHighlightsIntroTitle"><span className="liveHighlightsPulse"><i /> FESTIVAL IN FRAMES</span><strong>Big moments. Bright memories.</strong><small>Celebrating creativity, talent and expression across the festival.</small></div>
          <div className="liveHighlightsIntroCount"><Images /><span>APPROVED PHOTOGRAPHS</span><strong>{String(highlightTotalCount).padStart(2, "0")}</strong><small>{highlightLoadState === "error" ? "FEED OFFLINE" : highlightLoadState === "loading" ? "CONNECTING" : "UPDATED AUTOMATICALLY"}</small></div>
        </div>

        <section className={`liveHighlightsGallery${highlightRows.length === 0 ? " is-empty" : ""}`} aria-label="Latest approved festival photographs">
          {featuredPhotos.map((photo, index) => (
            <article className={`liveHighlightTile liveHighlightTile-${index + 1}${index === 0 ? " is-featured" : ""}${photo ? " has-photo" : " is-placeholder"}`} key={photo?.id ?? `highlight-placeholder-${index}`}>
              {photo ? (
                <>
                  <img className="liveHighlightImage" src={photo.photo_url} alt={photo.title || photo.event_name || "Sargamiya 2026 event photograph"} loading={index === 0 ? "eager" : "lazy"} />
                  <div className="liveHighlightImageScrim" />
                  <div className="liveHighlightCaption">
                    <span className="liveHighlightPhotoBadge">{index === 0 ? <><Sparkles /> FEATURED MOMENT</> : <><Camera /> MOMENT 0{index + 1}</>}</span>
                    <strong>{photo.title || photo.event_name || "A festival moment"}</strong>
                    <small>{photo.event_name || "ESRA Sargamiya 2026"}<i />{highlightPublishedLabel(photo.created_at)}</small>
                  </div>
                </>
              ) : (
                <div className={`liveHighlightPlaceholder${index === 0 ? " is-featured-placeholder" : ""}`}>
                  <span className="liveHighlightPlaceholderIcon">{index === 0 ? <Images /> : <Camera />}</span>
                  <strong>{index === 0 ? emptyTitle : "A new moment awaits"}</strong>
                  <p>{index === 0 ? emptyText : "More approved festival photographs will appear here."}</p>
                  {index === 0 && <div className="liveHighlightsMascots" aria-hidden="true"><img src="/images/canonical/nova-cutout.png" alt="" /><img src="/images/canonical/lumi-cutout.png" alt="" /></div>}
                </div>
              )}
              {photo && <span className="liveHighlightTileCorner" aria-hidden="true">✦</span>}
            </article>
          ))}
        </section>

        <footer className="scheduleSlideFooter liveHighlightsFooter">
          <img src="/brand/esra-logo-transparent.png" alt="ESRA Global Science Academy" />
          <div className="scheduleFooterValues"><span className="sValueCyan">ART</span><i /> CULTURE <i /> CREATIVITY <i /> <strong>TOGETHER WE SHINE</strong></div>
          <div className="scheduleSlideProgress"><span className="scheduleProgressDot" /><span>SLIDE 04 / 04</span><i /><span>AUTO-ROTATES EVERY 30 SEC</span></div>
        </footer>
      </main>
    );
  }

  if (slideIndex === 2) {
    const displayCards = [0, 1, 2].map((index) => latestResultEvents[index] ?? null);
    return (
      <main className="latestResultsSlidePage" aria-label="Sargamiya 2026 latest official results, last three events">
        <div className="scheduleSlideAtmosphere" aria-hidden="true" />
        <div className="scheduleSlideBeam scheduleSlideBeamOne" aria-hidden="true" />
        <div className="scheduleSlideBeam scheduleSlideBeamTwo" aria-hidden="true" />

        <header className="scheduleSlideHeader latestResultsHeader">
          <div className="scheduleSlideBrand">
            <img src="/brand/sargamiya-logo-transparent.png" alt="ESRA Sargamiya" />
            <span>2026 <small>ANNUAL ARTS FEST</small></span>
          </div>
          <div className="scheduleSlideTitleBlock">
            <h1><span>LATEST</span> RESULTS</h1>
            <div className="scheduleSlideTitleRule"><i /><b>✦</b><i /></div>
            <p>OFFICIAL PLACEMENTS <strong>· LAST 3 EVENTS</strong></p>
          </div>
          <div className="scheduleSlideDate latestResultsDate">
            <CalendarDays />
            <div><strong>24–28 OCT 2026</strong><span>ESRA CAMPUS</span><small><Clock3 /> {timeLabel(now)} <i /> RESULTS FEED</small></div>
          </div>
        </header>

        <div className="latestResultsIntro">
          <div className="latestResultsIntroCopy">
            <span className="latestResultsPulse"><i /> OFFICIAL RESULTS</span>
            <div><strong>The latest achievements</strong><small>Only officially published placements are displayed.</small></div>
          </div>
          <div className="latestResultsIntroMeta"><Trophy /><span>LAST 3 EVENTS</span><b>{latestResultEvents.length.toString().padStart(2, "0")} / 03</b></div>
        </div>

        <section className="latestResultsGrid" aria-label="Latest three events with official results">
          {displayCards.map((eventResult, cardIndex) => {
            if (!eventResult) {
              const emptyTitle = resultLoadState === "error"
                ? "Results feed unavailable"
                : resultLoadState === "loading"
                  ? "Loading official results"
                  : latestResultEvents.length === 0
                    ? "Results will appear here"
                    : "Awaiting next event results";
              const emptyText = resultLoadState === "error"
                ? "Check the public results view and its access permissions."
                : latestResultEvents.length === 0
                  ? "The board updates automatically when results are published."
                  : "This panel will fill when another event has official placements.";
              return (
                <article className={`latestResultEventCard latestResultCard-${cardIndex + 1} isEmpty`} key={`empty-${cardIndex}`}>
                  <header className="latestResultEventHeader"><span className="latestResultEventNumber">0{cardIndex + 1}</span><div><strong>EVENT RESULTS</strong><small>OFFICIAL BOARD</small></div><Trophy /></header>
                  <div className="latestResultEmptyBody"><span className="latestResultEmptyIcon"><Medal /></span><strong>{emptyTitle}</strong><p>{emptyText}</p></div>
                  <footer className="latestResultEventFooter"><span><i /> WAITING FOR PUBLISHED RESULTS</span></footer>
                </article>
              );
            }

            const eventMeta = [eventResult.category, eventResult.discipline, eventResult.eventFormat].filter(Boolean).join(" · ");
            return (
              <article className={`latestResultEventCard latestResultCard-${cardIndex + 1}`} key={eventResult.eventId}>
                <header className="latestResultEventHeader">
                  <span className="latestResultEventNumber">0{cardIndex + 1}</span>
                  <div className="latestResultEventHeading"><strong>{eventResult.eventName}</strong><small>{eventMeta || "Sargamiya competition"}</small></div>
                  <span className="latestResultOfficialBadge"><CheckCircle2 /> OFFICIAL</span>
                </header>
                <div className="latestResultPlaces">
                  {eventResult.placements.length ? eventResult.placements.map((row) => {
                    const metric = resultMetric(row.result_value, row.result_unit);
                    return (
                      <div className={`latestResultPlaceRow rank-${row.position}`} key={row.result_id}>
                        <div className={`latestResultMedal rank-${row.position}`}><Medal /><strong>{positionLabel(row.position)}</strong></div>
                        <div className="latestResultParticipant">
                          <strong>{row.participant_name || "Participant name unavailable"}</strong>
                          <div className="latestResultParticipantMeta">
                            <span className={`latestResultHouse ${houseClass(row.house || "")}`}>{row.house || "HOUSE TBA"}</span>
                            {row.chest_no !== null && <span>CHEST {row.chest_no}</span>}
                          </div>
                          {metric && <small className="latestResultMetric">RESULT: {metric}</small>}
                        </div>
                        <div className="latestResultPoints"><strong>{row.points_awarded === null ? "—" : Number(row.points_awarded).toLocaleString("en-IN")}</strong><small>PTS</small></div>
                      </div>
                    );
                  }) : (
                    <div className="latestResultNoPlacements"><Medal /><strong>Placements not available</strong><span>The published event does not yet contain 1st–3rd place entries.</span></div>
                  )}
                </div>
                <footer className="latestResultEventFooter"><span><i /> LAST UPDATED {resultPublishedLabel(eventResult.updatedAt)}</span><span>{eventResult.placements.length} PLACEMENTS</span></footer>
              </article>
            );
          })}
        </section>

        <footer className="scheduleSlideFooter latestResultsFooter">
          <img src="/brand/esra-logo-transparent.png" alt="ESRA Global Science Academy" />
          <div className="scheduleFooterValues"><span className="sValueCyan">ART</span><i /> CULTURE <i /> CREATIVITY <i /> <strong>TOGETHER WE SHINE</strong></div>
          <div className="scheduleSlideProgress"><span className="scheduleProgressDot" /><span>SLIDE 03 / 04</span><i /><span>AUTO-ROTATES EVERY 30 SEC</span></div>
        </footer>
      </main>
    );
  }

  if (slideIndex === 1) {
    const statusPanels = [
      {
        id: "ongoing", title: "ONGOING NOW", subtitle: "Competitions happening right now", tone: "ongoing",
        marker: "LIVE", Icon: CircleDot, rows: ongoingEvents, allCount: ongoingEvents.length,
        emptyTitle: "No event is live right now", emptyText: "All currently published schedule times are checked automatically.",
      },
      {
        id: "next", title: "UP NEXT", subtitle: "The next scheduled competitions", tone: "next",
        marker: "UPCOMING", Icon: Timer, rows: upcomingEvents, allCount: orderedSchedule.filter((slot) => {
          const start = scheduleTimestamp(slot.scheduled_date, slot.start_time);
          return start !== null && start > now;
        }).length,
        emptyTitle: "No upcoming timed events", emptyText: "Newly published schedule entries will appear here.",
      },
      {
        id: "finished", title: "RECENTLY FINISHED", subtitle: "Latest completed competitions", tone: "finished",
        marker: "COMPLETED", Icon: CheckCircle2, rows: recentlyFinishedEvents, allCount: orderedSchedule.filter((slot) => {
          const end = scheduleTimestamp(slot.scheduled_date, slot.end_time);
          return end !== null && end <= now;
        }).length,
        emptyTitle: "Waiting for the first finish", emptyText: "Completed competitions will move into this panel automatically.",
      },
    ] as const;

    return (
      <main className="scheduleSlidePage scheduleMultiSlidePage" aria-label="Sargamiya 2026 multi-event schedule slide">
        <div className="scheduleSlideAtmosphere" aria-hidden="true" />
        <div className="scheduleSlideBeam scheduleSlideBeamOne" aria-hidden="true" />
        <div className="scheduleSlideBeam scheduleSlideBeamTwo" aria-hidden="true" />
        <header className="scheduleSlideHeader">
          <div className="scheduleSlideBrand">
            <img src="/brand/sargamiya-logo-transparent.png" alt="ESRA Sargamiya" />
            <span>2026 <small>ANNUAL ARTS FEST</small></span>
          </div>
          <div className="scheduleSlideTitleBlock">
            <h1><span>EVENT</span> SCHEDULE</h1>
            <div className="scheduleSlideTitleRule"><i /><b>✦</b><i /></div>
            <p>S A R G A M I Y A <strong>2 0 2 6</strong></p>
          </div>
          <div className="scheduleSlideDate">
            <CalendarDays />
            <div><strong>24–28 OCT 2026</strong><span>ESRA CAMPUS</span><small><Clock3 /> {timeLabel(now)} <i /> LIVE SCHEDULE</small></div>
          </div>
        </header>

        <section className="scheduleMultiGrid" aria-label="Multiple concurrent events by schedule status">
          {statusPanels.map((panel) => {
            const PanelIcon = panel.Icon;
            const visibleRows = panel.rows;
            return (
              <article key={panel.id} className={`scheduleMultiPanel scheduleMulti-${panel.tone}`}>
                <header className="scheduleMultiPanelHeader">
                  <span className="scheduleMultiPanelIcon"><PanelIcon /></span>
                  <div className="scheduleMultiPanelHeading"><strong>{panel.title}</strong><small>{panel.subtitle}</small></div>
                  <div className="scheduleMultiCount"><strong>{panel.allCount}</strong><span>{panel.allCount === 1 ? "EVENT" : "EVENTS"}</span></div>
                </header>
                <div className="scheduleMultiList" data-scroll-key={panel.id}>
                  {visibleRows.map((slot, index) => {
                    const visual = visualForEvent(slot.event_name);
                    const EventIcon = visual.Icon;
                    const range = `${scheduleTimeLabel(slot.start_time)} – ${scheduleTimeLabel(slot.end_time)}`;
                    const meta = [slot.discipline, slot.category, slot.format].filter(Boolean).join(" · ");
                    return (
                      <div className="scheduleMultiEvent" key={slot.schedule_id}>
                        <div className="scheduleMultiEventIcon"><EventIcon /></div>
                        <div className="scheduleMultiEventBody">
                          <div className="scheduleMultiEventTopline">
                            <strong>{slot.event_name}</strong>
                            <span>{panel.id === "ongoing" ? "LIVE" : panel.id === "next" ? `#${index + 1} UP NEXT` : "FINISHED"}</span>
                          </div>
                          <div className="scheduleMultiEventMeta">{meta || "Festival event"}</div>
                          <div className="scheduleMultiEventDetails">
                            <span><Clock3 />{panel.id === "finished" ? `Ended ${scheduleTimeLabel(slot.end_time)}` : range}</span>
                            <span><MapPin />{slot.venue || "Venue TBA"}</span>
                            <span><CalendarDays />{scheduleDateLabel(slot.scheduled_date)}</span>
                          </div>
                          {slot.notes && <div className="scheduleMultiEventNote">{slot.notes}</div>}
                        </div>
                      </div>
                    );
                  })}
                  {!visibleRows.length && (
                    <div className="scheduleMultiEmpty">
                      <span className="scheduleMultiEmptyIcon"><CalendarDays /></span>
                      <strong>{panel.emptyTitle}</strong>
                      <p>{panel.emptyText}</p>
                    </div>
                  )}
                </div>
                <footer className="scheduleMultiPanelFooter">
                  <span className={panel.id === "ongoing" ? "scheduleMultiLiveDot" : "scheduleMultiFooterDot"} />
                  {panel.id === "ongoing" ? "STATUS UPDATES AUTOMATICALLY" : panel.id === "next" ? "ORDERED BY START TIME" : "ORDERED BY FINISH TIME"}
                </footer>
              </article>
            );
          })}
        </section>

        <footer className="scheduleSlideFooter">
          <img src="/brand/esra-logo-transparent.png" alt="ESRA Global Science Academy" />
          <div className="scheduleFooterValues"><span className="sValueCyan">ART</span><i /> CULTURE <i /> CREATIVITY <i /> <strong>TOGETHER WE SHINE</strong></div>
          <div className="scheduleSlideProgress"><span className="scheduleProgressDot" /><span>SLIDE 02 / 04</span><i /><span>AUTO-ROTATES EVERY 30 SEC</span></div>
        </footer>
      </main>
    );
  }

  return (
    <main className="liveScoreboardPage" aria-label="Sargamiya 2026 live house points">
      <div className="scoreboardAtmosphere" aria-hidden="true" />
      <div className="scoreboardBeam scoreboardBeamOne" aria-hidden="true" />
      <div className="scoreboardBeam scoreboardBeamTwo" aria-hidden="true" />
      <div className="scoreboardSpark scoreboardSparkOne" aria-hidden="true">✦</div>
      <div className="scoreboardSpark scoreboardSparkTwo" aria-hidden="true">✧</div>

      <header className="scoreboardHeader">
        <div className="scoreboardBrand">
          <img src="/brand/sargamiya-logo-transparent.png" alt="ESRA Sargamiya Annual Arts Fest" />
          <span className="scoreboardBrandYear">2026</span>
        </div>

        <div className="scoreboardTitleBlock">
          <div className="scoreboardTitleLine"><span>LIVE</span> HOUSE POINTS</div>
          <div className="scoreboardTitleRule"><i /><span>✦</span><i /></div>
          <div className="scoreboardSubtitle">S A R G A M I Y A <b>2 0 2 6</b></div>
        </div>

        <div className="scoreboardDateBlock">
          <span className="scoreboardDateIcon"><CalendarDays /></span>
          <div className="scoreboardDateCopy">
            <strong>24–28 OCT 2026</strong>
            <span>ESRA CAMPUS</span>
            <small><Clock3 /> {timeLabel(now)} <i className={dataState === "live" ? "scoreboardLiveDot" : "scoreboardLiveDot isWaiting"} /> {dataState === "live" ? "LIVE DATA" : dataState === "loading" ? "CONNECTING" : "RETRYING"}</small>
          </div>
        </div>
      </header>

      <section className="scoreboardStage" aria-label="House standings ranked by live points">
        <div className="scoreboardMascotFrame scoreboardMascotNova">
          <div className="scoreboardMascotGlow" />
          <img src="/images/canonical/nova-canonical-reference.webp" alt="NOVA, the ESRA mascot, cheering for all houses" />
          <div className="scoreboardMascotLabel"><span className="scoreboardMascotStar">✦</span><span><strong>NOVA</strong><small>CHEERING EVERY HOUSE</small></span></div>
        </div>

        <div className="scoreboardHouses">
          {displayHouses.map((house, index) => {
            const rank = house.hasTally ? index + 1 : 0;
            const cls = houseClass(house.house);
            return (
              <article className={`scoreboardHouseCard ${cls} ${rank ? `rank-${rank}` : "rank-pending"}`} key={house.house_id}>
                <div className="scoreboardCardLight" aria-hidden="true" />
                <div className="scoreboardHouseRibbon">{houseLabel(house.house)}</div>
                <HouseCrest house={house.house} />
                <h2>{house.house.toUpperCase()}</h2>
                <div className="scoreboardHouseMotto">{cls === "atlas" ? "DISCIPLINE · DETERMINATION · DESTINY" : cls === "olympus" ? "PASSION · PERSEVERANCE · PRESTIGE" : cls === "titan" ? "TALENT · TEAMWORK · TRIUMPH" : "ART · TALENT · EXCELLENCE"}</div>
                <div className="scoreboardScoreBox">
                  <strong>{house.hasTally ? Number(house.total_points).toLocaleString("en-IN") : "—"}</strong>
                  <span>POINTS</span>
                </div>
                <div className={`scoreboardRankMedal ${rank ? `medal-${rank}` : "medal-pending"}`}>
                  {rank ? <><Medal /><strong>{rankLabel(rank)}</strong></> : <><Trophy /><strong>WAITING</strong></>}
                </div>
                {!house.hasTally && <p className="scoreboardNoTally">Points will appear when the house tally is published.</p>}
              </article>
            );
          })}
        </div>

        <div className="scoreboardMascotFrame scoreboardMascotLumi">
          <div className="scoreboardMascotGlow" />
          <img src="/images/canonical/lumi-canonical-reference.webp" alt="LUMI, the creative arts mascot" />
          <div className="scoreboardMascotLabel"><span className="scoreboardMascotStar">✦</span><span><strong>LUMI</strong><small>COLOURING IDEAS INTO TOMORROW</small></span></div>
        </div>
      </section>

      <footer className="scoreboardFooter">
        <div className="scoreboardEsraBrand"><img src="/brand/esra-logo-transparent.png" alt="ESRA Global Science Academy" /></div>
        <div className="scoreboardValues">
          <span className="valueCreativity"><b>✿</b><span><strong>CREATIVITY</strong><small>IDEAS THAT INSPIRE</small></span></span>
          <i />
          <span className="valueTalent"><b>♫</b><span><strong>TALENT</strong><small>STAGES THAT SHINE</small></span></span>
          <i />
          <span className="valueExpression"><b>✧</b><span><strong>EXPRESSION</strong><small>VOICES THAT MATTER</small></span></span>
          <i />
          <span className="valueCommunity"><b>☆</b><span><strong>COMMUNITY</strong><small>TOGETHER WE GROW</small></span></span>
        </div>
        <div className="scoreboardFooterSlogan"><strong>TOGETHER,</strong><span>WE COLOUR A BRIGHTER TOMORROW.</span><small>{anyPoints ? "HOUSE POINTS UPDATE AUTOMATICALLY" : "WAITING FOR THE FIRST PUBLISHED HOUSE TALLY"}{lastUpdated ? ` · UPDATED ${timeLabel(lastUpdated)}` : ""}</small></div>
      </footer>
    </main>
  );
}
