"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  Medal,
  Megaphone,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Sparkles,
  Trophy,
  Volume2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Slot = {
  schedule_id: string;
  event_id: string;
  category: string;
  event_name: string;
  discipline: string;
  scheduled_date: string | null;
  start_time: string | null;
  end_time: string | null;
  venue: string | null;
  notes: string | null;
};
type Control = {
  mode: "auto" | "manual";
  current_event_id: string | null;
  status: string;
  message: string | null;
  updated_at: string;
};
type House = { house_id: string; house: string; total_points: number };
type HighlightPhoto = { id: string; title: string | null; event_name: string | null; photo_url: string; created_at: string };
type PublicResult = {
  result_id: string;
  event_id: string;
  category: string;
  discipline: string;
  event_name: string;
  position: number | null;
  points_awarded: number;
  participant_name: string;
  house: string | null;
  updated_at: string;
};

const slides = [
  {
    id: "standings",
    theme: "standings",
    eyebrow: "LIVE HOUSE STANDINGS",
    title: "Who’s leading the house race?",
    body: "Every performance counts. Follow Atlas, Titan and Olympus as points are added throughout Sargamiya 2026.",
    tag: "CURRENT STANDINGS · LIVE POINTS",
    image: "/images/sargamiya-standings-canonical.webp",
    imageAlt: "Canonical NOVA celebrates with a trophy beside crowned house podiums while LUMI cheers with her paintbrush",
    mascotNote: "Cheering for every house",
    cta: "View live standings",
  },
  {
    id: "upcoming",
    theme: "upcoming",
    eyebrow: "UPCOMING EVENTS",
    title: "What’s next on stage?",
    body: "A colourful line-up of creativity, talent and expression is on its way. Find the next performance and its venue at a glance.",
    tag: "NEXT UP · LIVE SCHEDULE",
    image: "/images/sargamiya-upcoming-canonical.webp",
    imageAlt: "Canonical NOVA points to a schedule clipboard while LUMI cheers on a colourful festival stage",
    mascotNote: "Your festival guides",
    cta: "View upcoming events",
  },
  {
    id: "results",
    theme: "results",
    eyebrow: "LATEST RESULTS",
    title: "The results are in!",
    body: "Celebrate every achievement. The latest officially published placements and house points appear here as the control room releases them.",
    tag: "OFFICIAL RESULTS · LIVE UPDATES",
    image: "/images/sargamiya-results-canonical.webp",
    imageAlt: "Canonical NOVA celebrates a medal beside a colourful results podium as LUMI points to the winners",
    mascotNote: "Celebrating every achievement",
    cta: "View latest results",
  },
  {
    id: "highlights",
    theme: "highlights",
    eyebrow: "FESTIVAL HIGHLIGHTS",
    title: "Big moments. Bright memories.",
    body: "From expressive words to spectacular performances, celebrate the energy and imagination that make Sargamiya special.",
    tag: "ART · CULTURE · CREATIVITY",
    image: "/images/sargamiya-highlights-canonical.webp",
    imageAlt: "Canonical NOVA explores festival memories with a magnifying glass while LUMI captures moments with her camera",
    mascotNote: "Collecting bright moments",
    cta: "Explore the programme",
  },
  {
    id: "announcements",
    theme: "announcements",
    eyebrow: "FESTIVAL ANNOUNCEMENTS",
    title: "Stay in the festival loop.",
    body: "Important updates from the control room appear here, so students, teachers and audiences can stay on the same page.",
    tag: "OFFICIAL NOTICES · LIVE UPDATES",
    image: "/images/sargamiya-announcements-canonical.webp",
    imageAlt: "Canonical NOVA announces festival updates through a megaphone beside LUMI holding a notice card",
    mascotNote: "Here with every update",
    cta: "Read festival notices",
  },
];

function timeLabel(value: string | null) {
  if (!value) return "Time TBA";
  const [hour, minute] = value.slice(0, 5).split(":").map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}

function shortResultDate(value: string | null | undefined) {
  if (!value) return "Recently published";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently published";
  return `Updated ${date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`;
}

function at(date: string | null, time: string | null) {
  return date && time ? new Date(`${date}T${time.slice(0, 8)}+05:30`).getTime() : null;
}

function autoStatus(schedule: Slot[], now: number) {
  const ordered = [...schedule].sort(
    (a, b) => (at(a.scheduled_date, a.start_time) ?? Infinity) - (at(b.scheduled_date, b.start_time) ?? Infinity),
  );
  // A festival can host several events at the same time, often at different venues.
  // Keep every active slot for the TV board, while retaining the first slot for legacy summaries.
  const liveEvents = ordered.filter((slot) => {
    const start = at(slot.scheduled_date, slot.start_time);
    const end = at(slot.scheduled_date, slot.end_time);
    return start !== null && now >= start && (end === null || now < end);
  });
  const live = liveEvents[0];
  const next = ordered.find((slot) => {
    const start = at(slot.scheduled_date, slot.start_time);
    return start !== null && start > now;
  });
  return { live, liveEvents, next, ordered };
}

function houseClass(name: string) {
  const key = name.toLowerCase();
  if (key.includes("atlas")) return "atlas";
  if (key.includes("titan")) return "titan";
  if (key.includes("olympus")) return "olympus";
  return "other";
}

export default function LivePage() {
  const supabase = useMemo(() => createClient(), []);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [control, setControl] = useState<Control | null>(null);
  const [houses, setHouses] = useState<House[]>([]);
  const [results, setResults] = useState<PublicResult[]>([]);
  const [highlightPhotos, setHighlightPhotos] = useState<HighlightPhoto[]>([]);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState("");
  const [slideIndex, setSlideIndex] = useState(0);
  const [slideshowPaused, setSlideshowPaused] = useState(false);

  const load = useCallback(async () => {
    const [scheduleResult, controlResult, houseResult, resultsResult, photosResult] = await Promise.all([
      supabase
        .from("athlon_public_schedule")
        .select("schedule_id,event_id,category,event_name,discipline,scheduled_date,start_time,end_time,venue,notes"),
      supabase.from("live_event_control").select("mode,current_event_id,status,message,updated_at").eq("id", 1).maybeSingle(),
      supabase.from("athlon_public_house_tally").select("house_id,house,total_points").order("total_points", { ascending: false }),
      supabase
        .from("athlon_public_results")
        .select("result_id,event_id,category,discipline,event_name,position,points_awarded,participant_name,house,updated_at")
        .order("updated_at", { ascending: false })
        .limit(3),
      supabase.from("live_highlights").select("id,title,event_name,photo_url,created_at").eq("is_published", true).order("created_at", { ascending: false }).limit(12),
    ]);

    if (scheduleResult.error) setError(scheduleResult.error.message);
    else setSlots((scheduleResult.data ?? []) as Slot[]);
    if (controlResult.data) setControl(controlResult.data as Control);
    if (!houseResult.error) setHouses((houseResult.data ?? []) as House[]);
    if (!resultsResult.error) setResults((resultsResult.data ?? []) as PublicResult[]);
    if (!photosResult.error) setHighlightPhotos((photosResult.data ?? []) as HighlightPhoto[]);
  }, [supabase]);

  useEffect(() => {
    void load();
    const clock = window.setInterval(() => setNow(Date.now()), 15000);
    const channel = supabase
      .channel("sargamiya-live-public")
      .on("postgres_changes", { event: "*", schema: "public", table: "live_event_control" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "event_schedule" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "house_points" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "results" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "live_highlights" }, () => void load())
      .subscribe();
    return () => {
      window.clearInterval(clock);
      void supabase.removeChannel(channel);
    };
  }, [load, supabase]);

  useEffect(() => {
    if (slideshowPaused) return;
    const timer = window.setInterval(() => setSlideIndex((current) => (current + 1) % slides.length), 6500);
    return () => window.clearInterval(timer);
  }, [slideshowPaused]);

  const schedule = autoStatus(slots, now);
  const manual = control?.mode === "manual";
  const chosen = manual ? slots.find((slot) => slot.event_id === control?.current_event_id) : schedule.live;
  const manualStatus = control?.status ?? "scheduled";
  const activeEvents = manual
    ? (manualStatus === "live" && chosen ? [chosen] : [])
    : schedule.liveEvents;
  const isActuallyLive = manual ? manualStatus === "live" : activeEvents.length > 0;
  const isDelayed = manual && manualStatus === "delayed";
  const isPaused = manual && manualStatus === "paused";
  const currentTitle = chosen?.event_name ?? (manual && manualStatus === "announcement" ? "Festival update" : "The stage is getting ready!");
  const next = manual && chosen
    ? schedule.ordered.find((slot) => slot.event_id !== chosen.event_id && (at(slot.scheduled_date, slot.start_time) ?? Infinity) > now)
    : schedule.next;
  const currentSlide = slides[slideIndex];
  const ctaHref = currentSlide.id === "standings" ? "/dashboard" : currentSlide.id === "results" ? "/results" : "/schedule";
  const highestHouseScore = Math.max(1, ...houses.map((house) => house.total_points));
  const upcomingEvents = schedule.ordered.filter((slot) => {
    const start = at(slot.scheduled_date, slot.start_time);
    return start !== null && start > now;
  }).slice(0, 3);

  function changeSlide(direction: number) {
    setSlideIndex((current) => (current + direction + slides.length) % slides.length);
  }

  return (
    <main className="livePage">
      <div className="liveGlow liveGlowOne" aria-hidden="true" />
      <div className="liveGlow liveGlowTwo" aria-hidden="true" />

      <div className="livePageInner">
        <header className="liveTopbar">
          <Link href="/live" className="liveBrand" aria-label="Sargamiya Live home">
            <img src="/brand/sargamiya-logo.png" alt="Sargamiya" />
            <span className="liveBrandDivider" />
            <span className="liveBrandCopy"><strong>SARGAMIYA 2026</strong><small>ANNUAL ARTS FEST</small></span>
          </Link>
          <nav className="liveNav" aria-label="Live page navigation">
            <Link href="/schedule"><CalendarDays size={16} /> Full Schedule</Link>
            <Link href="/dashboard"><Trophy size={16} /> Live Points</Link>
          </nav>
        </header>

        {error && <p role="alert" className="liveError">Live data could not fully load: {error}</p>}

        <section className={`liveHero liveHero-${currentSlide.theme}`} aria-roledescription="carousel" aria-label="Sargamiya festival highlights">
          <div className="liveHeroConfetti liveConfettiOne" aria-hidden="true">✦</div>
          <div className="liveHeroConfetti liveConfettiTwo" aria-hidden="true">✧</div>
          <div className="liveHeroConfetti liveConfettiThree" aria-hidden="true">✳</div>
          <div className="liveHeroCopy" key={currentSlide.id}>
            <span className="liveHeroEyebrow"><Sparkles size={15} /> {currentSlide.eyebrow}</span>
            <h1>{currentSlide.title}</h1>
            <p>{currentSlide.body}</p>
            {currentSlide.id === "standings" && (
              <div className="liveStandingsStrip" aria-label="Current house standings">
                {houses.length ? houses.slice(0, 3).map((house, index) => (
                  <div className={`liveStandingsMini ${houseClass(house.house)}`} key={house.house_id}>
                    <div className="liveStandingsMiniTop">
                      <span className="liveStandingsMiniRank">{String(index + 1).padStart(2, "0")}</span>
                      <strong>{house.house}</strong>
                    </div>
                    <b>{house.total_points.toLocaleString("en-IN")} <small>PTS</small></b>
                    <span className="liveStandingsTrack"><i style={{ width: `${Math.max(4, (house.total_points / highestHouseScore) * 100)}%` }} /></span>
                  </div>
                )) : (
                  <div className="liveStandingsLoading"><Trophy size={16} /> House standings will appear when points are published.</div>
                )}
              </div>
            )}
            {currentSlide.id === "upcoming" && (
              <div className="liveUpcomingList" aria-label="Next scheduled events">
                {upcomingEvents.length ? upcomingEvents.map((slot, index) => (
                  <div className={`liveUpcomingRow ${index === 0 ? "isNext" : ""}`} key={slot.schedule_id}>
                    <span className="liveUpcomingTime"><Clock3 size={13} />{timeLabel(slot.start_time)}</span>
                    <span className="liveUpcomingInfo"><strong>{slot.event_name}</strong><small>{slot.category}{slot.discipline ? ` · ${slot.discipline}` : ""}</small></span>
                    <span className="liveUpcomingVenue"><MapPin size={13} />{slot.venue || "Venue TBA"}</span>
                    {index === 0 && <span className="liveUpcomingBadge">NEXT</span>}
                  </div>
                )) : (
                  <div className="liveFeatureEmpty"><CalendarDays size={17} /><span>No future timed events are published yet. Check the full schedule for the latest programme.</span></div>
                )}
              </div>
            )}
            {currentSlide.id === "results" && (
              <div className="liveResultsBoard" aria-label="Latest official results">
                <div className="liveResultsBoardHeader">
                  <span className="liveResultsBoardIcon"><Medal size={18} /></span>
                  <span className="liveResultsBoardHeading"><strong>Official results board</strong><small>{results.length ? `${results.length} latest published ${results.length === 1 ? "result" : "results"}` : "Waiting for published results"}</small></span>
                  <span className="liveResultsVerified"><CheckCircle2 size={12} /> OFFICIAL</span>
                </div>
                {results.length ? results.map((result) => (
                  <article className={`liveResultRow rank${result.position || 0}`} key={result.result_id}>
                    <span className={`liveResultMedal rank${result.position || 0}`} aria-label={result.position ? `Position ${result.position}` : "Official result"}>
                      {result.position ? `#${result.position}` : <CheckCircle2 size={16} />}
                    </span>
                    <div className="liveResultInfo">
                      <div className="liveResultTitleLine">
                        <strong>{result.event_name}</strong>
                        {result.house && <span className={`liveResultHouse ${houseClass(result.house)}`}>{result.house}</span>}
                      </div>
                      <p>{result.participant_name}</p>
                      <small>{result.category}{result.discipline ? ` · ${result.discipline}` : ""}</small>
                    </div>
                    <div className="liveResultScore"><strong>{Number(result.points_awarded || 0).toLocaleString("en-IN")}<small> PTS</small></strong><span>{shortResultDate(result.updated_at)}</span></div>
                  </article>
                )) : <div className="liveFeatureEmpty"><Trophy size={17} /><span>Official results will appear here once the control room publishes them.</span></div>}
              </div>
            )}
            {currentSlide.id === "highlights" && (
              <div className="liveHighlightBoard" aria-label="Live festival highlights">
                <div className="liveHighlightBoardHead">
                  <span>FESTIVAL SPOTLIGHTS</span>
                  <span className="liveHighlightUpdated"><span /> LIVE DATA</span>
                </div>
                {highlightPhotos.length > 0 && (
                  <div className="livePhotoHighlights" aria-label="Live event photographs">
                    <div className="livePhotoHighlightsHead"><strong>LIVE EVENT PHOTOGRAPHS</strong><Link href="/admin/highlights">Manage photos</Link></div>
                    <div className="livePhotoHighlightsGrid">
                      {highlightPhotos.slice(0, 4).map((photo) => (
                        <figure className="livePhotoHighlight" key={photo.id}>
                          <img src={photo.photo_url} alt={photo.title || photo.event_name || "Sargamiya event photograph"} loading="lazy" />
                          <figcaption>{photo.title || photo.event_name || "Sargamiya 2026"}</figcaption>
                        </figure>
                      ))}
                    </div>
                  </div>
                )}
                <Link href="/dashboard" className="liveHighlightCard highlightHouse" aria-label="Open live house standings">
                  <span className="liveHighlightIcon"><Trophy size={20} /></span>
                  <span className="liveHighlightCopy">
                    <small>HOUSE SPIRIT</small>
                    <strong>{houses[0]?.house ?? "House standings"}</strong>
                    <span>{houses.length ? `${Number(houses[0].total_points || 0).toLocaleString("en-IN")} points on the board` : "House points will appear when published"}</span>
                  </span>
                  <ChevronRight className="liveHighlightArrow" size={18} />
                </Link>
                <Link href="/results" className="liveHighlightCard highlightAchievement" aria-label="Open latest official results">
                  <span className="liveHighlightIcon"><Medal size={20} /></span>
                  <span className="liveHighlightCopy">
                    <small>LATEST ACHIEVEMENT</small>
                    <strong>{results[0]?.event_name ?? "Official results spotlight"}</strong>
                    <span>{results[0] ? `${results[0].participant_name}${results[0].position ? ` · Position ${results[0].position}` : ""} · ${Number(results[0].points_awarded || 0).toLocaleString("en-IN")} pts` : "Published results will be celebrated here"}</span>
                  </span>
                  <ChevronRight className="liveHighlightArrow" size={18} />
                </Link>
                <Link href="/schedule" className="liveHighlightCard highlightNext" aria-label="Open the full event schedule">
                  <span className="liveHighlightIcon"><CalendarDays size={20} /></span>
                  <span className="liveHighlightCopy">
                    <small>NEXT SPOTLIGHT</small>
                    <strong>{upcomingEvents[0]?.event_name ?? "The next performance"}</strong>
                    <span>{upcomingEvents[0] ? `${upcomingEvents[0].category} · ${timeLabel(upcomingEvents[0].start_time)} · ${upcomingEvents[0].venue || "Venue TBA"}` : "Check the programme for the next event"}</span>
                  </span>
                  <ChevronRight className="liveHighlightArrow" size={18} />
                </Link>
              </div>
            )}
            {currentSlide.id === "announcements" && (
              <div className={`liveAnnouncementFeature ${control?.message ? "isPublished" : "isEmpty"}`}>
                <span className="liveAnnouncementIcon"><Megaphone size={19} /></span>
                <div className="liveAnnouncementContent">
                  <div className="liveAnnouncementMeta"><span className={`liveAnnouncementIndicator ${control?.message ? "hasMessage" : ""}`} /><strong>{control?.message ? "LATEST OFFICIAL NOTICE" : "NOTICE BOARD"}</strong><span className="liveAnnouncementStatus">{control?.message ? "PUBLISHED" : "STANDING BY"}</span></div>
                  <p>{control?.message || "No new announcement right now. Official programme changes and festival notices will appear here when published by the control room."}</p>
                  {control?.updated_at && <small className="liveAnnouncementUpdated">Control room updated · {new Date(control.updated_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</small>}
                </div>
              </div>
            )}
            <div className="liveHeroTag"><span className="liveTagDot" />{currentSlide.tag}</div>
            <div className="liveHeroActions">
              <Link href={ctaHref} className="livePrimaryCta">{currentSlide.cta}<ArrowRight size={17} /></Link>
              <Link href="/live" className="liveSecondaryCta"><Radio size={16} /> Live updates</Link>
            </div>
          </div>
          <div className="liveHeroArt" key={`${currentSlide.id}-art`}>
            <div className="liveArtHalo" />
            <div className="liveArtSpark liveArtSparkA">✦</div>
            <div className="liveArtSpark liveArtSparkB">✧</div>
            <img src={currentSlide.image} alt={currentSlide.imageAlt} />
            <div className="liveMascotCaption"><span className="liveMascotAvatar">✦</span><span><strong>NOVA &amp; LUMI</strong><small>{currentSlide.mascotNote}</small></span></div>
          </div>
          <div className="liveCarouselControls">
            <div className="liveSlideCounter"><strong>0{slideIndex + 1}</strong><span />0{slides.length}</div>
            <div className="liveSlideDots" role="group" aria-label="Choose festival slide">
              {slides.map((slide, index) => (
                <button key={slide.id} className={index === slideIndex ? "active" : ""} onClick={() => setSlideIndex(index)} aria-label={`Show slide ${index + 1}: ${slide.eyebrow}`} aria-pressed={index === slideIndex} />
              ))}
            </div>
            <div className="liveSlideButtons">
              <button onClick={() => changeSlide(-1)} aria-label="Previous slide"><ChevronLeft size={19} /></button>
              <button onClick={() => changeSlide(1)} aria-label="Next slide"><ChevronRight size={19} /></button>
              <button onClick={() => setSlideshowPaused((value) => !value)} aria-label={slideshowPaused ? "Play slideshow" : "Pause slideshow"} title={slideshowPaused ? "Play slideshow" : "Pause slideshow"}>{slideshowPaused ? <Play size={15} /> : <Pause size={15} />}</button>
            </div>
          </div>
        </section>

        <section className={`liveNowPanel ${isDelayed ? "isDelayed" : ""} ${isPaused ? "isPaused" : ""}`} aria-live="polite">
          <div className="liveNowMain">
            <div className="liveStatusEyebrow">
              <span className={`livePulse ${isActuallyLive ? "pulseOn" : ""}`} />
              {manual ? `MANUAL UPDATE · ${manualStatus.replace(/_/g, " ").toUpperCase()}` : isActuallyLive ? "HAPPENING RIGHT NOW" : "PROGRAMME STATUS"}
            </div>
            <h2>{activeEvents.length > 1 ? `${activeEvents.length} events happening now` : currentTitle}</h2>
            <p>{activeEvents.length > 1 ? "Live performances across the festival — check each venue below." : chosen ? `${chosen.category}${chosen.discipline ? ` · ${chosen.discipline}` : ""}` : manual && control?.message ? "A festival announcement from the control room" : "The next performance is on its way. Stay tuned for the next moment on stage."}</p>
            {activeEvents.length > 0 && <div className="liveConcurrentEvents" aria-label="All events happening now">
              {activeEvents.map((slot) => <article className="liveConcurrentEvent" key={slot.schedule_id}>
                <span className="liveConcurrentPulse" />
                <div className="liveConcurrentCopy"><strong>{slot.event_name}</strong><span>{slot.category}{slot.discipline ? ` · ${slot.discipline}` : ""}</span></div>
                <div className="liveConcurrentMeta"><span><MapPin size={14} />{slot.venue || "Venue TBA"}</span><span><Clock3 size={14} />{timeLabel(slot.start_time)} – {timeLabel(slot.end_time)}</span></div>
              </article>)}
            </div>}
            {manual && control?.message && <div className="liveStatusMessage"><Megaphone size={17} /><span>{control.message}</span></div>}
          </div>
          <div className="liveNowDetails">
            {chosen?.venue && <div><span className="liveDetailIcon"><MapPin size={17} /></span><span><small>VENUE</small><strong>{chosen.venue}</strong></span></div>}
            {chosen && <div><span className="liveDetailIcon"><Clock3 size={17} /></span><span><small>TIME SLOT</small><strong>{timeLabel(chosen.start_time)} – {timeLabel(chosen.end_time)}</strong></span></div>}
            {!chosen && <Link href="/schedule" className="livePanelSchedule">Check today&apos;s schedule <ArrowRight size={16} /></Link>}
          </div>
          <span className="livePanelStar" aria-hidden="true">✦</span>
        </section>

        <section className="liveInfoGrid" aria-label="Festival live information">
          <article className="liveInfoCard nextCard">
            <div className="liveCardHeading"><span className="liveCardIcon nextIcon"><Clock3 size={20} /></span><span className="liveCardKicker">COMING UP</span></div>
            {next ? <>
              <div className="liveNextTime">{timeLabel(next.start_time)}</div>
              <h3>{next.event_name}</h3>
              <p className="liveCardMeta">{next.category}{next.discipline ? ` · ${next.discipline}` : ""}</p>
              <div className="liveVenueLine"><MapPin size={15} /> {next.venue ?? "Venue to be announced"}</div>
            </> : <>
              <h3>The next moment awaits.</h3>
              <p className="liveCardMeta">There are no future timed events available yet.</p>
              <Link className="liveTextLink" href="/schedule">Browse schedule <ArrowRight size={15} /></Link>
            </>}
            <div className="liveCardDecoration decorClock" aria-hidden="true">◷</div>
          </article>

          <article className="liveInfoCard pointsCard">
            <div className="liveCardHeading"><span className="liveCardIcon pointsIcon"><Trophy size={20} /></span><span className="liveCardKicker">HOUSE LEADERBOARD</span></div>
            <div className="liveHouseList">
              {houses.length ? houses.map((house, index) => (
                <div className={`liveHouseRow ${houseClass(house.house)}`} key={house.house_id}>
                  <span className="liveHouseRank">{String(index + 1).padStart(2, "0")}</span>
                  <span className="liveHouseMedal" />
                  <strong>{house.house}</strong>
                  <b>{house.total_points}<small> pts</small></b>
                </div>
              )) : <p className="liveCardMeta">House standings will appear here.</p>}
            </div>
            <Link className="liveTextLink" href="/dashboard">View full standings <ArrowRight size={15} /></Link>
            <div className="liveCardDecoration decorTrophy" aria-hidden="true">✦</div>
          </article>

          <article className="liveInfoCard noticeCard">
            <div className="liveCardHeading"><span className="liveCardIcon noticeIcon"><Megaphone size={20} /></span><span className="liveCardKicker">FESTIVAL NOTICE</span></div>
            <h3>{isDelayed ? "A little change of pace." : isPaused ? "Programme temporarily paused" : "Stay in the loop!"}</h3>
            <p className="liveCardMeta">{manual && control?.message ? control.message : isDelayed ? "An event is delayed. Please follow the update above for the latest information." : isPaused ? "The programme is paused for now. Updates will be posted here." : "Follow this page for programme changes, announcements and moments worth cheering for."}</p>
            <div className="liveNoticeFoot"><Volume2 size={15} /> Updates refresh automatically <span className="liveNoticeDot" /></div>
            <div className="liveCardDecoration decorNotice" aria-hidden="true">✧</div>
          </article>
        </section>

        <footer className="liveFooter">
          <span className="liveFooterSpark"><Sparkles size={17} /></span>
          <span><strong>Keep the Sargamiya spirit shining.</strong><small>NOVA and LUMI are cheering you on!</small></span>
          <Link href="/schedule">See the programme <ArrowRight size={16} /></Link>
        </footer>
        <p className="liveUpdateFoot"><RefreshCw size={13} /> Automatic status follows the published schedule unless an administrator enables manual override. <span>Last control update: {control?.updated_at ? new Date(control.updated_at).toLocaleTimeString("en-IN") : "—"}</span></p>
      </div>
    </main>
  );
}
