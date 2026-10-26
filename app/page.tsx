"use client";

import Image from "next/image";
import Link from "next/link";
import HouseLogo from "@/components/athlon/HouseLogo";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Activity,
  Award,
  ArrowRight,
  BarChart3,
  CalendarDays,
  Images,
  Home,
  ClipboardList,
  Medal,
  RefreshCw,
  Trophy,
  Users,
  Menu,
  X,
  Camera,
  Atom,
  Cpu,
  Cog,
  Pi,
  Leaf,
  MapPin,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";

/* ============================================================
   TYPES
============================================================ */

type House = "Atlas" | "Titan" | "Olympus";

type HouseRow = {
  house_id: string;
  house: House;
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

type EventRow = {
  event_id: string;
  category: string;
  discipline: string;
  event_name: string;
  event_format: string;
};

type HighlightPhoto = {
  id: string;
  title: string | null;
  event_name: string | null;
  photo_url: string;
  created_at: string;
};

/* ============================================================
   FALLBACK DATA
============================================================ */

const fallbackHouses: HouseRow[] = [
  {
    house_id: "atlas",
    house: "Atlas",
    total_points: 0,
    last_points_at: null,
  },
  {
    house_id: "titan",
    house: "Titan",
    total_points: 0,
    last_points_at: null,
  },
  {
    house_id: "olympus",
    house: "Olympus",
    total_points: 0,
    last_points_at: null,
  },
];

const EMPTY_SUMMARY: Summary = {
  active_students: 0,
  total_events: 0,
  completed_events: 0,
  total_points: 0,
  last_points_update: null,
};

/* ============================================================
   NAVIGATION
============================================================ */

const NAV_ITEMS = [
  {
    label: "Home",
    href: "/",
  },
  {
    label: "Schedule",
    href: "/schedule",
  },
  {
    label: "Live Dashboard",
    href: "/live",
  },
  {
    label: "Highlights",
    href: "/highlights",
  },
  {
    label: "Live Points",
    href: "/dashboard",
  },
  {
    label: "Results",
    href: "/results",
  },
  {
    label: "Certificates",
    href: "/certificates",
  },
  {
    label: "Analytics",
    href: "/admin/analytics",
  },
];

/* ============================================================
   HOUSE HELPERS
============================================================ */

function houseClass(house: House) {
  return house.toLowerCase();
}

function houseInitial(house: House) {
  return house.charAt(0);
}

/* ============================================================
   HOME PAGE
============================================================ */

export default function HomePage() {
  /*
   * IMPORTANT
   *
   * The Supabase client is NOT created during render.
   *
   * Next.js 16 prerenders Client Components during the
   * production build. Creating the client during render can
   * cause environment-dependent Supabase code to execute
   * during prerendering.
   *
   * Therefore the client is created only inside useEffect
   * or an explicit browser interaction.
   */

  const supabaseRef =
    useRef<ReturnType<typeof createClient> | null>(null);

  const [summary, setSummary] =
    useState<Summary>(EMPTY_SUMMARY);

  const [houses, setHouses] =
    useState<HouseRow[]>(fallbackHouses);

  const [events, setEvents] =
    useState<EventRow[]>([]);

  const [highlights, setHighlights] =
    useState<HighlightPhoto[]>([]);

  const [mobileMenuOpen, setMobileMenuOpen] =
    useState(false);

  const [refreshing, setRefreshing] =
    useState(false);

  const [dataError, setDataError] =
    useState<string | null>(null);

  /* ==========================================================
     LOAD DASHBOARD DATA
  ========================================================== */

  const loadDashboard = useCallback(
    async (
      supabase: ReturnType<typeof createClient>,
      silent = false
    ) => {
      if (silent) {
        setRefreshing(true);
      }

      try {
        const [
          summaryResult,
          houseResult,
          eventResult,
        ] = await Promise.all([
          supabase
            .from("athlon_public_dashboard_summary")
            .select(
              "active_students,total_events,completed_events,total_points,last_points_update"
            )
            .single(),

          supabase
            .from("athlon_public_house_tally")
            .select(
              "house_id,house,total_points,last_points_at"
            )
            .order("total_points", {
              ascending: false,
            })
            .order("house_id"),

          supabase
            .from("athlon_public_event_catalogue")
            .select(
              "event_id,category,discipline,event_name,event_format"
            )
            .order("category")
            .order("discipline")
            .order("event_name")
            .limit(6),
        ]);

        const errors = [
          summaryResult.error,
          houseResult.error,
          eventResult.error,
        ].filter(Boolean);

        if (errors.length > 0) {
          console.error(
            "SARGAMIYA dashboard data error:",
            errors
          );

          setDataError(
            "Some live data could not be loaded."
          );
        } else {
          setDataError(null);
        }

        if (
          !summaryResult.error &&
          summaryResult.data
        ) {
          setSummary(
            summaryResult.data as Summary
          );
        }

        if (
          !houseResult.error &&
          houseResult.data?.length
        ) {
          setHouses(
            houseResult.data as HouseRow[]
          );
        }

        if (
          !eventResult.error &&
          eventResult.data
        ) {
          setEvents(
            eventResult.data as EventRow[]
          );
        }
      } catch (error) {
        console.error(
          "SARGAMIYA dashboard request failed:",
          error
        );

        setDataError(
          "Live dashboard data is temporarily unavailable."
        );
      } finally {
        setRefreshing(false);
      }
    },
    []
  );
  /* ==========================================================
     INITIALIZE SUPABASE — BROWSER ONLY
     
     IMPORTANT:
     We intentionally use polling instead of postgres_changes
     here. This avoids the realtime callback ordering issue
     that was appearing in the browser console.
  ========================================================== */

  useEffect(() => {
    let mounted = true;

    const initializeDashboard = async () => {
      try {
        const supabase = createClient();

        if (!mounted) {
          return;
        }

        supabaseRef.current = supabase;

        await loadDashboard(supabase);

        const timer = window.setInterval(() => {
          if (
            mounted &&
            supabaseRef.current
          ) {
            void loadDashboard(
              supabaseRef.current,
              true
            );
          }
        }, 10000);

        return () => {
          window.clearInterval(timer);
        };
      } catch (error) {
        console.error(
          "Supabase initialization failed:",
          error
        );

        if (mounted) {
          setDataError(
            "Live data connection needs attention."
          );
        }
      }
    };

    let cleanup:
      | (() => void)
      | undefined;

    initializeDashboard().then(
      (result) => {
        cleanup = result;
      }
    );

    return () => {
      mounted = false;

      if (cleanup) {
        cleanup();
      }

      supabaseRef.current = null;
    };
  }, [loadDashboard]);

  /* ==========================================================
     HOME PHOTO PREVIEW — published live highlights
  ========================================================== */

  useEffect(() => {
    let active = true;
    const loadPhotos = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("live_highlights")
          .select("id,title,event_name,photo_url,created_at")
          .eq("is_published", true)
          .order("created_at", { ascending: false })
          .limit(3);
        if (!error && active && data) {
          setHighlights(data as HighlightPhoto[]);
        }
      } catch (error) {
        console.warn("Home highlights preview is unavailable", error);
      }
    };
    void loadPhotos();
    const timer = window.setInterval(() => void loadPhotos(), 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  /* ==========================================================
     MANUAL REFRESH
  ========================================================== */

  const handleRefresh = useCallback(() => {
    const supabase =
      supabaseRef.current ?? createClient();

    supabaseRef.current = supabase;

    void loadDashboard(
      supabase,
      true
    );
  }, [loadDashboard]);

  /* ==========================================================
     DERIVED VALUES
  ========================================================== */

  const leader = houses[0];

  const maxPoints = Math.max(
    ...houses.map((house) =>
      Number(house.total_points || 0)
    ),
    1
  );

  const completion =
    summary.total_events > 0
      ? Math.min(
          100,
          Math.round(
            (summary.completed_events /
              summary.total_events) *
              100
          )
        )
      : 0;

  /* ==========================================================
     PAGE
  ========================================================== */

  return (
    <>
      <main className="athlonHomeV2">

        {/* ====================================================
            NAVIGATION
        ==================================================== */}

        <header className="athlonNavV2">

          {/* BRAND — FAR LEFT */}

          <Link
            href="/"
            className="athlonNavBrandV2"
            aria-label="SARGAMIYA 2026 home"
          >
            <Image
              src="/brand/sargamiya-logo-transparent.png"
              alt="Sargamiya Annual Arts Fest"
              width={230}
              height={115}
              priority
            />
          </Link>


          <button
            type="button"
            className="athlonMobileMenuButtonV2"
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            {mobileMenuOpen ? <X size={23} /> : <Menu size={23} />}
          </button>

          {/* NAVIGATION — CENTER ON DESKTOP, DROPDOWN ON MOBILE */}
          <nav
            className={`athlonNavLinksV2 ${mobileMenuOpen ? "isOpen" : ""}`}
            aria-label="Main navigation"
          >
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={item.href === "/" ? "active" : ""}
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* ESRA BRAND + ADMIN */}
          <div className="athlonNavActionsV2">
            <div className="athlonEsraBrandV2" aria-label="ESRA Global Science Academy">
              <Image src="/brand/esra-symbol-transparent.png" alt="" width={48} height={48} priority />
              <span><strong>esra</strong><small>GLOBAL SCIENCE<br />ACADEMY</small></span>
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              title="Refresh live data"
              aria-label="Refresh live data"
              className="athlonRefreshV2"
            >
              <RefreshCw
                size={17}
                className={
                  refreshing
                    ? "athlonSpinV2"
                    : ""
                }
              />
            </button>


            <Link
              href="/admin/students"
              className="athlonAdminV2"
            >
              <Users size={16} />
              <span>
                Admin
              </span>
            </Link>

          </div>

        </header>


        {/* ====================================================
            HERO
        ==================================================== */}

        <section className="athlonHeroV2" aria-label="Sargamiya 2026 Annual Arts Fest">

          <div
            className="athlonHeroBackgroundV2"
            aria-hidden="true"
          />

          <div
            className="athlonHeroShadeV2"
            aria-hidden="true"
          />


          <div className="athlonHeroInnerV2">

            {/* HERO COPY — LEFT SIDE */}

            <div className="athlonHeroCopyV2">

              <div className="athlonHeroEyebrowV2">
                <span>ESRA GLOBAL SCIENCE ACADEMY</span>
                <i />
                <span>ANNUAL ARTS FEST 2026</span>
              </div>

              <h1>
                <span className="athlonHeroTitleLineV2">SARGAMIYA</span>
                <span className="athlonHeroTitleLineV2"><strong>2026</strong></span>
              </h1>

              <div className="athlonHeroSublineV2">ANNUAL ARTS FEST</div>
              <p className="athlonHeroDescriptionV2">A festival of creativity, talent and expression.</p>
              <div className="athlonHeroSloganV2"><strong>CREATE</strong><i>•</i> EXPRESS <i>•</i> INSPIRE</div>
              <div className="athlonHeroTaglineV2">Together, we colour a brighter tomorrow.</div>


              {/* HERO METRICS */}

              <div className="athlonHeroMetaV2">
                <span><CalendarDays size={15} /><strong>24–28 OCT 2026</strong></span>
                <span><MapPin size={15} /><strong>ESRA CAMPUS</strong></span>
              </div>


              {/* LIVE STATUS */}

              <div className="athlonLiveStatusV2">

                <span />

                LIVE SARGAMIYA 2026

              </div>

            </div>

            <div className="athlonHeroMascotsV2" aria-label="Official Sargamiya mascots NOVA and LUMI">
              <div className="athlonMascotCardV2 athlonNovaCardV2">
                <Image src="/images/canonical/nova-cutout.png" alt="NOVA, the official ESRA mascot, with the floating NOVA star and ESRA chest emblem" width={300} height={410} priority />
                <span className="athlonMascotNameV2">NOVA <small>CURIOUS BY NATURE</small></span>
              </div>
              <div className="athlonMascotCardV2 athlonLumiCardV2">
                <Image src="/images/canonical/lumi-cutout.png" alt="LUMI, the official ESRA creative artist with orange beret, star clip, paintbrush and palette" width={655} height={810} priority />
                <span className="athlonMascotNameV2">LUMI <small>CREATIVE BY HEART</small></span>
              </div>
            </div>

                          {/* HERO ACTIONS */}

              <div className="athlonHeroButtonsV2">

                <Link
                  href="/schedule"
                  className="athlonPrimaryButtonV2"
                >
                  <CalendarDays
                    size={17}
                  />

                  <span>
                    View Event Schedule
                  </span>

                  <ArrowRight
                    size={17}
                  />
                </Link>


                <Link
                  href="/dashboard"
                  className="athlonSecondaryButtonV2"
                >
                  <Trophy
                    size={17}
                  />

                  <span>
                    Live House Points
                  </span>
                </Link>

                <Link
                  href="/live"
                  className="athlonSecondaryButtonV2 mobilePriorityButtonV2"
                >
                  <Activity size={17} />
                  <span>Live Dashboard</span>
                </Link>

                <Link
                  href="/highlights"
                  className="athlonSecondaryButtonV2 mobilePriorityButtonV2"
                >
                  <Images size={17} />
                  <span>Photo Highlights</span>
                </Link>

              </div>



          </div>

        </section>


        {/* ====================================================
            LIVE DATA WARNING
        ==================================================== */}

        {dataError && (
          <div className="athlonDataNoticeV2">

            <span>
              {dataError}
            </span>

            <button
              type="button"
              onClick={handleRefresh}
            >
              Retry
            </button>

          </div>
        )}


        {/* ====================================================
            QUICK ACCESS
        ==================================================== */}

        <section className="athlonSectionV2">

          <div className="athlonSectionHeadingV2">

            <div>

              <span>
                SARGAMIYA 2026
              </span>

              <h2>
                Your festival,
                all in one place.
              </h2>

            </div>


            <p>
              Explore schedules, live
              house standings, official
              results and performance
              insights from one unified
              arts festival platform.
            </p>

          </div>


          <div className="athlonQuickGridV2">

            {/* SCHEDULE */}

            <Link
              href="/schedule"
              className="athlonQuickCardV2"
            >

              <div className="athlonQuickIconV2">
                <CalendarDays
                  size={21}
                />
              </div>

              <span>
                PROGRAMME
              </span>

              <h3>
                Event Schedule
              </h3>

              <p>
                Check the complete
                programme, dates,
                times and venues.
              </p>

              <strong>
                Explore Schedule
                <ArrowRight
                  size={14}
                />
              </strong>

            </Link>


            {/* LIVE POINTS */}

            <Link
              href="/dashboard"
              className="athlonQuickCardV2"
            >

              <div className="athlonQuickIconV2 green">
                <Trophy
                  size={21}
                />
              </div>

              <span>
                CHAMPIONSHIP
              </span>

              <h3>
                Live House Points
              </h3>

              <p>
                Follow the championship
                standings and see which
                house is leading.
              </p>

              <strong>
                View Live Points
                <ArrowRight
                  size={14}
                />
              </strong>

            </Link>


            {/* LIVE DASHBOARD */}

            <Link href="/live" className="athlonQuickCardV2">
              <div className="athlonQuickIconV2 orange"><Activity size={21} /></div>
              <span>LIVE FESTIVAL</span>
              <h3>Live Dashboard</h3>
              <p>See the current festival status, upcoming events, latest results, standings and announcements.</p>
              <strong>Open Live Dashboard <ArrowRight size={14} /></strong>
            </Link>

            {/* PHOTO HIGHLIGHTS */}

            <Link href="/highlights" className="athlonQuickCardV2">
              <div className="athlonQuickIconV2 purple"><Images size={21} /></div>
              <span>FESTIVAL MOMENTS</span>
              <h3>Photo Highlights</h3>
              <p>Browse approved photographs captured during Sargamiya 2026 events.</p>
              <strong>View Photographs <ArrowRight size={14} /></strong>
            </Link>

            {/* RESULTS */}

            <Link
              href="/results"
              className="athlonQuickCardV2"
            >

              <div className="athlonQuickIconV2 purple">
                <Medal
                  size={21}
                />
              </div>

              <span>
                ACHIEVEMENTS
              </span>

              <h3>
                Official Results
              </h3>

              <p>
                Explore event-wise
                results and celebrate
                student achievements.
              </p>

              <strong>
                View Results
                <ArrowRight
                  size={14}
                />
              </strong>

            </Link>


            {/* CERTIFICATES */}

            <Link
              href="/certificates"
              className="athlonQuickCardV2"
            >
              <div className="athlonQuickIconV2 gold">
                <Award size={21} />
              </div>

              <span>
                ACHIEVEMENTS
              </span>

              <h3>
                Certificates
              </h3>

              <p>
                Find official Sargamiya achievement certificates and download them directly.
              </p>

              <strong>
                Download Certificate
                <ArrowRight size={14} />
              </strong>
            </Link>


            {/* ANALYTICS */}

            <Link
              href="/admin/analytics"
              className="athlonQuickCardV2"
            >

              <div className="athlonQuickIconV2 orange">
                <BarChart3
                  size={21}
                />
              </div>

              <span>
                INSIGHTS
              </span>

              <h3>
                Analytics
              </h3>

              <p>
                Discover performance
                statistics, progress and
                house comparisons.
              </p>

              <strong>
                View Analytics
                <ArrowRight
                  size={14}
                />
              </strong>

            </Link>

          </div>

        </section>


        {/* ====================================================
            STATISTICS
        ==================================================== */}

        <section className="athlonStatsV2">

          <div>
            <Activity
              size={20}
            />

            <strong>
              {summary.total_events || 0}
            </strong>

            <span>
              Total Events
            </span>
          </div>


          <div>
            <Users
              size={20}
            />

            <strong>
              3
            </strong>

            <span>
              Houses
            </span>
          </div>


          <div>
            <Trophy
              size={20}
            />

            <strong>
              {summary.completed_events || 0}
            </strong>

            <span>
              Events Completed
            </span>
          </div>


          <div>
            <Medal
              size={20}
            />

            <strong>
              {summary.total_points || 0}
            </strong>

            <span>
              Points Awarded
            </span>
          </div>


          <div>
            <Users
              size={20}
            />

            <strong>
              {summary.active_students || 0}
            </strong>

            <span>
              Active Students
            </span>
          </div>

        </section>


        {/* ====================================================
            DATA GRID
        ==================================================== */}

        <section className="athlonDataGridV2">

          {/* PHOTO HIGHLIGHTS PREVIEW */}
          <div className="athlonPanelV2 athlonHighlightsPanelV2">
            <div className="athlonPanelHeaderV2">
              <div>
                <span>FESTIVAL MOMENTS</span>
                <h2>Today’s Highlights</h2>
              </div>
              <Link href="/highlights">View All <ArrowRight size={14} /></Link>
            </div>
            {highlights.length > 0 ? (
              <div className="athlonHomePhotosV2">
                {highlights.map((photo, index) => (
                  <Link href="/highlights" className={`athlonHomePhotoV2 photo-${index + 1}`} key={photo.id} aria-label={`Open photo highlights: ${photo.title || photo.event_name || "Festival photograph"}`}>
                    <Image src={photo.photo_url} alt={photo.title || photo.event_name || "Sargamiya 2026 event photograph"} width={480} height={320} unoptimized />
                    <span>{photo.title || photo.event_name || "Sargamiya 2026"}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <Link href="/highlights" className="athlonHomePhotosEmptyV2">
                <Camera size={28} />
                <strong>Festival moments will appear here</strong>
                <span>Browse the photo gallery</span>
              </Link>
            )}
          </div>

          {/* ==================================================
              UPCOMING PROGRAMME
          ================================================== */}

          <div className="athlonPanelV2">

            <div className="athlonPanelHeaderV2">

              <div>

                <span>
                  PROGRAMME
                </span>

                <h2>
                  Upcoming Events
                </h2>

              </div>


              <Link
                href="/schedule"
              >
                Full Schedule
                <ArrowRight
                  size={14}
                />
              </Link>

            </div>


            <div className="athlonProgrammeV2">

              {events.length > 0 ? (
                events.map(
                  (event) => (
                    <Link
                      href="/schedule"
                      key={
                        event.event_id
                      }
                      className="athlonProgrammeRowV2"
                    >

                      <div>

                        <strong>
                          {event.event_name}
                        </strong>

                        <span>
                          {event.discipline ||
                            event.category}
                        </span>

                      </div>


                      <small>
                        {event.event_format}
                      </small>

                    </Link>
                  )
                )
              ) : (
                <div className="athlonEmptyV2">

                  <ClipboardList
                    size={25}
                  />

                  <strong>
                    Event catalogue is ready.
                  </strong>

                  <span>
                    Schedule entries will
                    appear here.
                  </span>

                </div>
              )}

            </div>

          </div>

        </section>


        {/* ====================================================
            CHAMPIONSHIP PROGRESS
        ==================================================== */}

        <section className="athlonProgressV2">

          <div className="athlonProgressIntroV2">

            <span>
              SARGAMIYA PROGRESS
            </span>

            <strong>
              {completion}%
            </strong>

            <p>
              {summary.completed_events} of{" "}
              {summary.total_events} events
              completed
            </p>

          </div>


          <div className="athlonProgressBarWrapV2">

            <div className="athlonProgressBarV2">

              <span
                style={{
                  width:
                    `${completion}%`,
                }}
              />

            </div>


            <div className="athlonProgressLabelsV2">

              <span>
                Championship progress
              </span>

              <span>
                {summary.total_events >
                0
                  ? `${Math.max(
                      summary.total_events -
                        summary.completed_events,
                      0
                    )} remaining`
                  : "No events completed yet"}
              </span>

            </div>

          </div>


          <div className="athlonLeaderV2">

            <span>
              CURRENT LEADER
            </span>

            <strong>
              {leader?.total_points
                ? leader.house
                : "Awaiting results"}
            </strong>

            <p>
              {leader?.total_points
                ? `${leader.total_points} championship points`
                : "The championship begins with the first official result."}
            </p>

          </div>

        </section>


        <section className="athlonDisciplineStripV2" aria-label="Festival disciplines">
          <div><Atom size={23} /><span>SCIENCE</span></div>
          <div><Cpu size={23} /><span>TECHNOLOGY</span></div>
          <div><Cog size={23} /><span>ENGINEERING</span></div>
          <div><Pi size={23} /><span>MATHEMATICS</span></div>
          <div><Camera size={23} /><span>ARTS</span></div>
          <div><Trophy size={23} /><span>SPORTS</span></div>
          <div><Users size={23} /><span>LEADERSHIP</span></div>
          <div><Leaf size={23} /><span>ENVIRONMENT</span></div>
        </section>

        {/* ====================================================
            FOOTER
        ==================================================== */}

        <footer className="athlonFooterV2">

          <div className="athlonFooterBrandV2">

            <div className="athlonFooterLogo">
              SARGAMIYA
            </div>

            <div>

              <strong>
                ESRA Global Science Academy
              </strong>

              <span>
                Create. Express. Inspire.
                Together, we colour a brighter tomorrow.
              </span>

            </div>

          </div>


          <div className="athlonFooterMetaV2">

            <strong>
              SARGAMIYA 2026
            </strong>

            <span>
              Create. Express. Inspire. Together, we colour a brighter tomorrow.
            </span>

          </div>

        </footer>

        <nav className="athlonMobileDockV2" aria-label="Quick mobile navigation">
          <Link href="/" className="selected" onClick={() => setMobileMenuOpen(false)}><Home size={19} /><small>Home</small></Link>
          <Link href="/schedule" onClick={() => setMobileMenuOpen(false)}><CalendarDays size={19} /><small>Schedule</small></Link>
          <Link href="/live" onClick={() => setMobileMenuOpen(false)}><Activity size={19} /><small>Live</small></Link>
          <Link href="/highlights" onClick={() => setMobileMenuOpen(false)}><Images size={19} /><small>Highlights</small></Link>
        </nav>
      </main>


      {/* ======================================================
          PAGE-SPECIFIC STYLES

          Everything remains inside page.tsx.
          No globals.css changes are required.
      ====================================================== */}

      <style jsx global>{`

        * {
          box-sizing: border-box;
        }


        html {
          scroll-behavior: smooth;
        }


        body {
          margin: 0;
        }


        .athlonHomeV2 {
          min-height: 100vh;

          background: #f5f8fc;

          color: #071a3d;

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


        /* =====================================================
           NAVIGATION
        ===================================================== */

        .athlonNavV2 {
          position: relative;

          z-index: 50;

          height: 80px;

          display: flex;

          align-items: center;

          padding: 0 32px;

          background: #061938;

          color: white;

          border-bottom:
            1px solid
            rgba(255,255,255,0.08);
        }


        .athlonNavBrandV2 {
          display: flex;
          align-items: center;
          width: 154px;
          min-width: 154px;
          height: 62px;
          padding: 2px 6px;
          border-radius: 8px;
          background: #ffffff;
          text-decoration: none;
          overflow: hidden;
        }

        .athlonNavBrandV2 img {
          display: block;
          width: 142px;
          height: 58px;
          object-fit: contain;
        }


        .athlonNavBrandV2 span {
          font-size: 23px;

          font-weight: 900;

          letter-spacing:
            -0.04em;
        }


        .athlonNavBrandV2 small {
          color: #5da5ff;

          font-size: 11px;

          font-weight: 800;
        }


        .athlonNavLinksV2 {
          display: flex;

          align-items: center;

          justify-content: center;

          gap: 27px;

          flex: 1;
          min-width: 0;
        }


        .athlonNavLinksV2 a {
          position: relative;

          padding:
            28px 0;

          color:
            rgba(255,255,255,0.62);

          text-decoration: none;

          font-size: 13px;

          font-weight: 700;

          transition:
            color 160ms ease;
        }


        .athlonNavLinksV2 a:hover,
        .athlonNavLinksV2 a.active {
          color: white;
        }


        .athlonNavLinksV2 a.active::after {
          content: "";

          position: absolute;

          left: 0;

          right: 0;

          bottom: 0;

          height: 3px;

          background: #2387ff;

          border-radius:
            3px 3px 0 0;
        }


        .athlonNavActionsV2 {
          display: flex;

          align-items: center;

          justify-content: flex-end;

          gap: 10px;

          min-width: 190px;
        }


        .athlonRefreshV2 {
          width: 38px;

          height: 38px;

          display: grid;

          place-items: center;

          border:
            1px solid
            rgba(255,255,255,0.13);

          border-radius: 10px;

          background:
            rgba(255,255,255,0.06);

          color: white;

          cursor: pointer;

          transition:
            background 160ms ease;
        }


        .athlonRefreshV2:hover {
          background:
            rgba(255,255,255,0.11);
        }


        .athlonRefreshV2:disabled {
          opacity: 0.55;

          cursor: default;
        }


        .athlonAdminV2 {
          display: inline-flex;

          align-items: center;

          justify-content: center;

          gap: 8px;

          min-height: 38px;

          padding: 0 15px;

          border-radius: 10px;

          background: #187cf2;

          color: white;

          text-decoration: none;

          font-size: 13px;

          font-weight: 800;

          transition:
            background 160ms ease,
            transform 160ms ease;
        }


        .athlonAdminV2:hover {
          background: #2b8cff;

          transform:
            translateY(-1px);
        }


        .athlonSpinV2 {
          animation:
            athlonSpinV2
            0.8s
            linear
            infinite;
        }


        @keyframes athlonSpinV2 {
          to {
            transform:
              rotate(360deg);
          }
        }


        /* =====================================================
           HERO
        ===================================================== */

        .athlonHeroV2 {
          position: relative;

          min-height: 620px;

          overflow: hidden;

          background: #f8fbff;

          color: #0a2045;

          isolation: isolate;
        }


        .athlonHeroBackgroundV2 {
          position: absolute;

          inset: 0;

          z-index: -3;

          background-color: #f8fbff;
          background-image: none;
          background-size: cover;
          background-position: center center;

          background-repeat: no-repeat;

          transform: scale(1.005);
        }


        .athlonHeroShadeV2 {
          position: absolute;

          inset: 0;

          z-index: -2;

          background:
            linear-gradient(90deg, rgba(248,251,255,.99) 0%, rgba(248,251,255,.97) 29%, rgba(248,251,255,.86) 39%, rgba(248,251,255,.28) 52%, rgba(248,251,255,0) 64%),
            linear-gradient(0deg, rgba(7,25,55,.12) 0%, rgba(7,25,55,0) 25%);
        }


        .athlonHeroInnerV2 {
          position: relative;

          z-index: 2;

          width:
            min(
              1380px,
              calc(100% - 80px)
            );

          min-height: 620px;

          margin: 0 auto;

          display: flex;

          align-items: center;
          justify-content: flex-start;
        }


        .athlonHeroCopyV2 {
          position: relative;
          width: 42%;
          max-width: 560px;
          padding: 38px 0 34px;
        }


        .athlonHeroEyebrowV2 {
          display: flex;

          align-items: center;

          gap: 10px;

          color: #1a4c89;

          font-size: 10px;

          font-weight: 900;

          letter-spacing:
            0.16em;
        }


        .athlonHeroEyebrowV2 i {
          width: 4px;

          height: 4px;

          flex: 0 0 4px;

          border-radius: 50%;

          background: #4a9bff;
        }


        .athlonHeroCopyV2 h1 {
          margin:
            18px 0 0;

          color: #09214a;

          font-size: clamp(44px, 4.2vw, 60px);

          line-height: 1.02;

          letter-spacing:
            -0.055em;

          font-weight: 900;
        }


        .athlonHeroTitleLineV2 {
          display: block;
          white-space: nowrap;
        }

        .athlonHeroCopyV2 h1 strong {
          color: #167cf0;
          font-weight: 900;
        }


        .athlonHeroDescriptionV2 {
          max-width: 560px;

          margin:
            21px 0 0;

          color: #506079;

          font-size: 16px;

          line-height: 1.65;
        }


        .athlonHeroButtonsV2 {
          display: flex;

          align-items: center;

          gap: 10px;

          margin-top: 25px;
          flex-wrap: wrap;
        }


        .athlonPrimaryButtonV2,
        .athlonSecondaryButtonV2 {
          display: inline-flex;

          align-items: center;

          justify-content: center;

          gap: 9px;

          min-height: 46px;

          padding:
            0 13px;

          border-radius: 11px;

          text-decoration: none;

          font-size: 12px;

          font-weight: 800;
          white-space: nowrap;

          transition:
            transform 160ms ease,
            box-shadow 160ms ease,
            background 160ms ease;
        }


        .athlonPrimaryButtonV2 {
          background: #2388f5;

          color: white;

          box-shadow:
            0 12px 30px
            rgba(35,136,245,0.20);
        }


        .athlonPrimaryButtonV2:hover {
          background: #3294ff;

          transform:
            translateY(-2px);
        }


        .athlonSecondaryButtonV2 {
          background: #f5f7fb;

          color: #071a3d;
        }


        .athlonSecondaryButtonV2:hover {
          background: white;

          transform:
            translateY(-2px);
        }


        .athlonCertificateButtonV2 {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          min-height: 50px;
          padding: 0 18px;
          border: 1px solid rgba(255,255,255,0.16);
          border-radius: 11px;
          background: rgba(255,255,255,0.08);
          color: white;
          text-decoration: none;
          font-size: 14px;
          font-weight: 800;
          transition: transform 160ms ease, background 160ms ease, border-color 160ms ease;
        }


        .athlonCertificateButtonV2:hover {
          background: rgba(255,255,255,0.15);
          border-color: rgba(255,255,255,0.28);
          transform: translateY(-2px);
        }


        .athlonHeroMetaV2 {
          display: flex;

          align-items: stretch;

          gap: 0;

          margin-top: 27px;
        }


        .athlonHeroMetaV2 > span {
          display: flex;

          flex-direction: column;

          gap: 7px;

          min-width: 88px;

          padding-right: 24px;

          margin-right: 24px;

          border-right: 1px solid rgba(9,33,74,0.13);

          color: #677994;

          font-size: 9px;

          font-weight: 800;

          letter-spacing:
            0.08em;

          text-transform:
            uppercase;
        }


        .athlonHeroMetaV2 > span:last-child {
          padding-right: 0;

          margin-right: 0;

          border-right: 0;
        }


        .athlonHeroMetaV2 strong {
          color: #09214a;

          font-size: 20px;

          line-height: 1;

          font-weight: 900;

          letter-spacing:
            -0.03em;
        }


        .athlonLiveStatusV2 {
          display: flex;

          align-items: center;

          gap: 9px;

          margin-top: 17px;

          color: #61718a;

          font-size: 10px;

          font-weight: 800;

          letter-spacing:
            0.14em;
        }


        .athlonLiveStatusV2 span {
          width: 8px;

          height: 8px;

          border-radius: 50%;

          background: #32d37f;

          box-shadow:
            0 0 0 4px
              rgba(50,211,127,0.12),
            0 0 15px
              rgba(50,211,127,0.7);
        }


        /* =====================================================
           DATA WARNING
        ===================================================== */

        .athlonDataNoticeV2 {
          width:
            min(
              1380px,
              calc(100% - 80px)
            );

          margin:
            18px auto 0;

          display: flex;

          align-items: center;

          justify-content: space-between;

          gap: 20px;

          padding:
            12px 16px;

          border:
            1px solid
            #fed7aa;

          border-radius: 10px;

          background: #fff7ed;

          color: #9a3412;

          font-size: 13px;
        }


        .athlonDataNoticeV2 button {
          border: 0;

          background:
            transparent;

          color: #c2410c;

          font-weight: 800;

          cursor: pointer;
        }


        /* =====================================================
           GENERAL SECTION
        ===================================================== */

        .athlonSectionV2,
        .athlonDataGridV2,
        .athlonProgressV2 {
          width:
            min(
              1380px,
              calc(100% - 80px)
            );

          margin-left: auto;

          margin-right: auto;
        }


        .athlonSectionV2 {
          padding-top: 70px;
        }


        .athlonSectionHeadingV2 {
          display: flex;

          align-items: flex-end;

          justify-content:
            space-between;

          gap: 30px;

          margin-bottom: 28px;
        }


        .athlonSectionHeadingV2 > div > span,
        .athlonPanelHeaderV2 > div > span,
        .athlonProgressIntroV2 > span,
        .athlonLeaderV2 > span {
          color: #237fe8;

          font-size: 10px;

          font-weight: 900;

          letter-spacing:
            0.14em;
        }


        .athlonSectionHeadingV2 h2 {
          margin:
            8px 0 0;

          color: #071a3d;

          font-size:
            clamp(
              30px,
              3.5vw,
              46px
            );

          line-height: 1;

          letter-spacing:
            -0.045em;
        }


        .athlonSectionHeadingV2 p {
          max-width: 390px;

          margin: 0;

          color: #6b7b91;

          font-size: 15px;

          line-height: 1.7;
        }


        /* =====================================================
           QUICK CARDS
        ===================================================== */

        .athlonQuickGridV2 {
          display: grid;

          grid-template-columns:
            repeat(5, 1fr);

          gap: 16px;
        }


        .athlonQuickCardV2 {
          position: relative;

          min-height: 265px;

          display: flex;

          flex-direction: column;

          padding: 25px;

          overflow: hidden;

          border:
            1px solid
            #e3eaf2;

          border-radius: 20px;

          background: white;

          box-shadow:
            0 12px 35px
            rgba(9,36,75,0.035);

          text-decoration: none;

          transition:
            transform 180ms ease,
            box-shadow 180ms ease;
        }


        .athlonQuickCardV2:hover {
          transform:
            translateY(-4px);

          box-shadow:
            0 20px 42px
            rgba(9,36,75,0.10);
        }


        .athlonQuickCardV2::after {
          content: "";

          position: absolute;

          width: 130px;

          height: 130px;

          right: -50px;

          bottom: -50px;

          border-radius: 50%;

          background:
            rgba(35,127,232,0.055);
        }


        .athlonQuickIconV2 {
          width: 46px;

          height: 46px;

          display: grid;

          place-items: center;

          margin-bottom: 23px;

          border-radius: 13px;

          background:
            #edf5ff;

          color: #167bf1;
        }


        .athlonQuickIconV2.green {
          background:
            #ecfbf3;

          color: #16a365;
        }


        .athlonQuickIconV2.purple {
          background:
            #f3efff;

          color: #7654d8;
        }


        .athlonQuickIconV2.orange {
          background:
            #fff4e8;

          color: #e78222;
        }


        .athlonQuickIconV2.gold {
          background:
            #fff8e7;

          color: #b78310;
        }


        .athlonQuickCardV2 > span {
          color: #8998aa;

          font-size: 9px;

          font-weight: 900;

          letter-spacing:
            0.14em;
        }


        .athlonQuickCardV2 h3 {
          margin:
            7px 0 8px;

          color: #071a3d;

          font-size: 21px;

          letter-spacing:
            -0.025em;
        }


        .athlonQuickCardV2 p {
          margin: 0;

          color: #718095;

          font-size: 13px;

          line-height: 1.6;
        }


        .athlonQuickCardV2 strong {
          display: flex;

          align-items: center;

          gap: 7px;

          margin-top: auto;

          padding-top: 20px;

          color: #167bf1;

          font-size: 12px;
        }


        /* =====================================================
           STATISTICS
        ===================================================== */

        .athlonStatsV2 {
          width:
            min(
              1380px,
              calc(100% - 80px)
            );

          margin:
            22px auto 0;

          display: grid;

          grid-template-columns:
            repeat(5, 1fr);

          overflow: hidden;

          border-radius: 20px;

          background: #061a3d;

          color: white;
        }


        .athlonStatsV2 > div {
          min-height: 125px;

          display: flex;

          flex-direction: column;

          justify-content: center;

          padding:
            20px 26px;

          border-right:
            1px solid
            rgba(255,255,255,0.08);
        }


        .athlonStatsV2 > div:last-child {
          border-right: 0;
        }


        .athlonStatsV2 svg {
          margin-bottom: 10px;

          color: #4a9bff;
        }


        .athlonStatsV2 strong {
          font-size: 30px;

          line-height: 1;
        }


        .athlonStatsV2 span {
          margin-top: 6px;

          color:
            rgba(255,255,255,0.50);

          font-size: 10px;

          font-weight: 800;

          letter-spacing:
            0.08em;

          text-transform:
            uppercase;
        }


        /* =====================================================
           DATA GRID
        ===================================================== */

        .athlonDataGridV2 {
          display: grid;

          grid-template-columns:
            1fr 1fr;

          gap: 18px;

          margin-top: 70px;
        }


        .athlonPanelV2 {
          min-width: 0;

          padding: 27px;

          border:
            1px solid
            #e2e9f2;

          border-radius: 20px;

          background: white;

          box-shadow:
            0 12px 35px
            rgba(9,36,75,0.045);
        }


        .athlonPanelHeaderV2 {
          display: flex;

          align-items: flex-start;

          justify-content:
            space-between;

          gap: 20px;

          margin-bottom: 24px;
        }


        .athlonPanelHeaderV2 h2 {
          margin:
            6px 0 0;

          color: #071a3d;

          font-size: 25px;

          letter-spacing:
            -0.035em;
        }


        .athlonPanelHeaderV2 a {
          display: inline-flex;

          align-items: center;

          gap: 6px;

          color: #167bf1;

          text-decoration: none;

          font-size: 11px;

          font-weight: 800;

          white-space: nowrap;
        }


        /* =====================================================
           STANDINGS
        ===================================================== */

        .athlonStandingsV2 {
          display: flex;

          flex-direction: column;

          gap: 10px;
        }


        .athlonStandingRowV2 {
          display: grid;

          grid-template-columns:
            32px 44px 1fr;

          align-items: center;

          gap: 13px;

          padding: 12px;

          border:
            1px solid
            #edf1f6;

          border-radius: 14px;

          background: #fbfcfe;
        }


        .athlonRankV2 {
          width: 28px;

          height: 28px;

          display: flex;

          align-items: center;

          justify-content: center;

          border-radius: 9px;

          background: #eef3f8;

          color: #607086;

          font-size: 11px;

          font-weight: 900;
        }


        .athlonHouseBadgeV2 {
          width: 44px;

          height: 44px;

          display: flex;

          align-items: center;

          justify-content: center;

          border-radius: 13px;

          background:
            linear-gradient(
              135deg,
              #e9f3ff,
              #d6e9ff
            );

          color: #167bf1;

          font-size: 15px;

          font-weight: 900;
        }


        .athlonHouseBadgeV2.titan {
          background:
            linear-gradient(
              135deg,
              #fff0f0,
              #ffdede
            );

          color: #c7363f;
        }


        .athlonHouseBadgeV2.olympus {
          background:
            linear-gradient(
              135deg,
              #f0f2f5,
              #e3e7ec
            );

          color: #697587;
        }


        .athlonStandingInfoV2 {
          min-width: 0;
        }


        .athlonStandingInfoV2 > div:first-child {
          display: flex;

          align-items: center;

          justify-content:
            space-between;

          gap: 12px;
        }


        .athlonStandingInfoV2 strong {
          color: #071a3d;

          font-size: 14px;
        }


        .athlonStandingInfoV2 span {
          color: #8290a1;

          font-size: 10px;
        }


        .athlonStandingTrackV2 {
          height: 6px;

          margin-top: 9px;

          overflow: hidden;

          border-radius: 999px;

          background: #eaf0f6;
        }


        .athlonStandingTrackV2 span {
          display: block;

          height: 100%;

          border-radius: inherit;

          background:
            linear-gradient(
              90deg,
              #167bf1,
              #5daaff
            );
        }


        .athlonStandingRowV2:nth-child(2)
          .athlonStandingTrackV2
          span {
          background:
            linear-gradient(
              90deg,
              #d63b45,
              #ef7b82
            );
        }


        .athlonStandingRowV2:nth-child(3)
          .athlonStandingTrackV2
          span {
          background:
            linear-gradient(
              90deg,
              #7d8795,
              #b9c0c9
            );
        }


        /* =====================================================
           PROGRAMME
        ===================================================== */

        .athlonProgrammeV2 {
          display: flex;

          flex-direction: column;

          gap: 8px;
        }


        .athlonProgrammeRowV2 {
          display: flex;

          align-items: center;

          justify-content:
            space-between;

          gap: 20px;

          padding:
            13px 14px;

          border:
            1px solid
            #edf1f6;

          border-radius: 12px;

          background: #fbfcfe;

          text-decoration: none;

          transition:
            background 160ms ease,
            transform 160ms ease;
        }


        .athlonProgrammeRowV2:hover {
          background: #f5f9ff;

          transform:
            translateX(2px);
        }


        .athlonProgrammeRowV2 div {
          min-width: 0;

          display: flex;

          flex-direction: column;

          gap: 4px;
        }


        .athlonProgrammeRowV2 strong {
          color: #071a3d;

          font-size: 13px;

          overflow: hidden;

          text-overflow: ellipsis;

          white-space: nowrap;
        }


        .athlonProgrammeRowV2 span {
          color: #7a889a;

          font-size: 10px;
        }


        .athlonProgrammeRowV2 small {
          color: #738196;

          font-size: 10px;

          font-weight: 700;

          white-space: nowrap;
        }


        .athlonEmptyV2 {
          min-height: 170px;

          display: flex;

          flex-direction: column;

          align-items: center;

          justify-content: center;

          gap: 8px;

          padding:
            35px 15px;

          color: #8794a5;

          text-align: center;

          font-size: 13px;

          line-height: 1.6;
        }


        .athlonEmptyV2 strong {
          color: #5d6b7c;
        }


        /* =====================================================
           PROGRESS
        ===================================================== */

        .athlonProgressV2 {
          display: grid;

          grid-template-columns:
            190px 1fr 270px;

          align-items: center;

          gap: 35px;

          margin-top: 18px;

          padding:
            25px 28px;

          border-radius: 20px;

          background:
            linear-gradient(
              120deg,
              #061a3d,
              #0a2d61
            );

          color: white;
        }


        .athlonProgressIntroV2 {
          display: flex;

          flex-direction: column;
        }


        .athlonProgressIntroV2 > span {
          color: #65aaff;
        }


        .athlonProgressIntroV2 strong {
          margin-top: 5px;

          font-size: 38px;

          line-height: 1;
        }


        .athlonProgressIntroV2 p {
          margin:
            6px 0 0;

          color:
            rgba(255,255,255,0.55);

          font-size: 10px;
        }


        .athlonProgressBarWrapV2 {
          min-width: 0;
        }


        .athlonProgressBarV2 {
          height: 9px;

          overflow: hidden;

          border-radius: 999px;

          background:
            rgba(255,255,255,0.10);
        }


        .athlonProgressBarV2 span {
          display: block;

          height: 100%;

          border-radius: inherit;

          background:
            linear-gradient(
              90deg,
              #167bf1,
              #69b0ff
            );

          transition:
            width 500ms ease;
        }


        .athlonProgressLabelsV2 {
          display: flex;

          align-items: center;

          justify-content:
            space-between;

          gap: 15px;

          margin-top: 10px;

          color:
            rgba(255,255,255,0.48);

          font-size: 10px;
        }


        .athlonLeaderV2 {
          display: flex;

          flex-direction: column;

          padding-left: 25px;

          border-left:
            1px solid
            rgba(255,255,255,0.10);
        }


        .athlonLeaderV2 > span {
          color: #65aaff;
        }


        .athlonLeaderV2 strong {
          margin-top: 4px;

          font-size: 21px;
        }


        .athlonLeaderV2 p {
          margin:
            4px 0 0;

          color:
            rgba(255,255,255,0.55);

          font-size: 10px;
        }


        /* =====================================================
           FOOTER
        ===================================================== */

        .athlonFooterV2 {
          width: 100%;

          display: flex;

          align-items: center;

          justify-content:
            space-between;

          gap: 30px;

          margin-top: 70px;

          padding:
            35px
            max(
              40px,
              calc(
                (100vw - 1380px) / 2
              )
            );

          background: #061a3d;

          color: white;
        }


        .athlonFooterBrandV2 {
          display: flex;

          align-items: center;

          gap: 15px;
        }


        .athlonFooterLogo {
          display: flex;

          align-items: center;

          justify-content: center;

          width: 76px;

          height: 38px;

          border:
            1px solid
            rgba(255,255,255,0.15);

          border-radius: 8px;

          color: white;

          font-size: 16px;

          font-weight: 900;

          letter-spacing:
            -0.04em;
        }


        .athlonFooterBrandV2 div:last-child {
          display: flex;

          flex-direction: column;

          gap: 4px;
        }


        .athlonFooterBrandV2 strong {
          font-size: 13px;
        }


        .athlonFooterBrandV2 span {
          color:
            rgba(255,255,255,0.50);

          font-size: 10px;
        }


        .athlonFooterMetaV2 {
          display: flex;

          flex-direction: column;

          align-items: flex-end;

          gap: 4px;
        }


        .athlonFooterMetaV2 strong {
          font-size: 12px;
        }


        .athlonFooterMetaV2 span {
          color:
            rgba(255,255,255,0.50);

          font-size: 10px;
        }


        /* =====================================================
           TABLET
        ===================================================== */

        @media (max-width: 1050px) {

          .athlonNavV2 {
            padding:
              0 24px;
          }


          .athlonNavBrandV2 {
            min-width: 145px;
          }


          .athlonNavLinksV2 {
            gap: 20px;
          }


          .athlonNavActionsV2 {
            min-width: 145px;
          }


          .athlonHeroInnerV2 {
            width: calc(100% - 48px);
          }

          .athlonHeroCopyV2 {
            width: 42%;
            max-width: 520px;
          }

          .athlonHeroCopyV2 h1 {
            font-size: clamp(34px, 4vw, 42px);
          }

          .athlonHeroButtonsV2 {
            gap: 8px;
          }


          .athlonQuickGridV2 {
            grid-template-columns:
              repeat(2, 1fr);
          }


          .athlonStatsV2 {
            grid-template-columns:
              repeat(3, 1fr);
          }


          .athlonStatsV2 > div:nth-child(3) {
            border-right: 0;
          }


          .athlonDataGridV2 {
            grid-template-columns:
              1fr;
          }


          .athlonProgressV2 {
            grid-template-columns:
              170px 1fr;
          }


          .athlonLeaderV2 {
            grid-column:
              1 / -1;

            padding:
              18px 0 0;

            border-left: 0;

            border-top:
              1px solid
              rgba(255,255,255,0.10);
          }

        }


        /* =====================================================
           MOBILE
        ===================================================== */

        @media (max-width: 760px) {

          .athlonNavV2 {
            height: auto;

            min-height: 70px;

            flex-wrap: wrap;

            padding:
              14px 18px;

            gap: 12px;
          }


          .athlonNavBrandV2 {
            min-width: 0;
          }


          .athlonNavLinksV2 {
            order: 3;

            width: 100%;

            justify-content:
              flex-start;

            overflow-x: auto;

            gap: 22px;
          }


          .athlonNavLinksV2 a {
            padding:
              8px 0;

            white-space: nowrap;
          }


          .athlonNavLinksV2 a.active::after {
            bottom: 0;
          }


          .athlonNavActionsV2 {
            margin-left: auto;

            min-width: 0;
          }


          .athlonAdminV2 {
            padding:
              0 11px;
          }


          .athlonHeroV2 {
            min-height: 0;
            padding-top: 265px;
            background: #f8fbff;
          }

          .athlonHeroBackgroundV2 {
            inset: 0 0 auto;
            height: 340px;
            background-size: auto 100%;
            background-position: 70% center;
          }

          .athlonHeroShadeV2 {
            inset: 0 0 auto;
            height: 340px;
            background: linear-gradient(180deg, rgba(248,251,255,0) 58%, rgba(248,251,255,.35) 79%, #f8fbff 100%);
          }

          .athlonHeroInnerV2 {
            width: calc(100% - 36px);
            min-height: 0;
            align-items: flex-start;
            justify-content: flex-start;
          }

          .athlonHeroCopyV2 {
            width: 100%;
            max-width: none;
            padding: 16px 0 28px;
          }

          .athlonHeroEyebrowV2 {
            flex-wrap: wrap;
            font-size: 9px;
            color: #1a4c89;
          }

          .athlonHeroCopyV2 h1 {
            font-size: clamp(36px, 9.2vw, 52px);
            line-height: 1;
            margin-top: 14px;
          }

          .athlonHeroTitleLineV2 {
            white-space: normal;
          }

          .athlonHeroDescriptionV2 {
            max-width: 560px;
            margin-top: 17px;
            font-size: 15px;
          }


          .athlonHeroButtonsV2 {
            flex-direction: column;

            align-items: stretch;
          }


          .athlonPrimaryButtonV2,
          .athlonSecondaryButtonV2,
          .athlonCertificateButtonV2 {
            width: 100%;
          }


          .athlonHeroMetaV2 {
            gap: 14px 18px;
            flex-wrap: wrap;
            margin-top: 24px;
          }

          .athlonHeroMetaV2 > span {
            min-width: 74px;
            margin-right: 0;
            padding-right: 0;
            border-right: 0;
          }

          .athlonLiveStatusV2 {
            margin-top: 18px;
          }


          .athlonSectionV2,
          .athlonDataGridV2,
          .athlonProgressV2 {
            width:
              calc(100% - 32px);
          }


          .athlonSectionV2 {
            padding-top: 48px;
          }


          .athlonSectionHeadingV2 {
            display: block;
          }


          .athlonSectionHeadingV2 p {
            margin-top: 18px;
          }


          .athlonQuickGridV2 {
            grid-template-columns:
              1fr;
          }


          .athlonStatsV2 {
            width:
              calc(100% - 32px);

            grid-template-columns:
              repeat(2, 1fr);
          }


          .athlonStatsV2 > div:nth-child(2) {
            border-right: 0;
          }


          .athlonStatsV2 > div:nth-child(3) {
            border-right:
              1px solid
              rgba(255,255,255,0.08);
          }


          .athlonStatsV2 > div {
            min-height: 110px;
          }


          .athlonDataGridV2 {
            margin-top: 48px;
          }


          .athlonPanelV2 {
            padding: 20px;
          }


          .athlonProgressV2 {
            grid-template-columns: 1fr;

            gap: 20px;

            margin-top: 16px;
          }


          .athlonLeaderV2 {
            grid-column: auto;

            padding:
              18px 0 0;

            border-left: 0;

            border-top:
              1px solid
              rgba(255,255,255,0.10);
          }


          .athlonFooterV2 {
            flex-direction: column;

            align-items: flex-start;

            padding:
              30px 20px;
          }


          .athlonFooterMetaV2 {
            align-items: flex-start;
          }

        }


        /* =====================================================
           SMALL MOBILE
        ===================================================== */

        @media (max-width: 450px) {

          .athlonNavActionsV2
            .athlonRefreshV2 {
            display: none;
          }


          .athlonAdminV2 span {
            display: none;
          }


          .athlonHeroV2 {
            padding-top: 235px;
          }

          .athlonHeroBackgroundV2,
          .athlonHeroShadeV2 {
            height: 300px;
          }

          .athlonHeroInnerV2 {
            min-height: 0;
          }


          .athlonHeroEyebrowV2 {
            font-size: 9px;

            letter-spacing:
              0.11em;
          }


          .athlonHeroMetaV2 {
            display: grid;

            grid-template-columns:
              repeat(2, 1fr);

            gap: 14px;
          }


          .athlonHeroMetaV2 > span {
            min-width: 0;

            padding-right: 0;

            margin-right: 0;

            border-right: 0;
          }


          .athlonStatsV2 {
            grid-template-columns: 1fr;
          }


          .athlonStatsV2 > div {
            border-right: 0 !important;

            border-bottom:
              1px solid
              rgba(255,255,255,0.08);
          }


          .athlonStatsV2 > div:last-child {
            border-bottom: 0;
          }


          .athlonStandingRowV2 {
            grid-template-columns:
              30px 38px 1fr;

            gap: 8px;
          }


          .athlonHouseBadgeV2 {
            width: 38px;

            height: 38px;
          }


          .athlonStandingInfoV2
            > div:first-child {
            align-items: flex-start;

            flex-direction: column;

            gap: 2px;
          }


          .athlonProgrammeRowV2 small {
            display: none;
          }


          .athlonProgressLabelsV2 {
            flex-direction: column;

            align-items: flex-start;

            gap: 4px;
          }

        }


        /* MOBILE-FIRST POLISH: navigation, touch targets and flexible layouts */
        .athlonNavLinksV2 a { min-height: 42px; display: inline-flex; align-items: center; }
        .athlonQuickCardV2 { min-width: 0; }
        .athlonHeroButtonsV2 { flex-wrap: wrap; }
        .mobilePriorityButtonV2 { border: 1px solid rgba(255,255,255,.22); }
        .athlonHomeV2 img { max-width: 100%; }
        @media (max-width: 760px) {
          .athlonNavV2 { position: sticky; top: 0; padding: 10px 14px; gap: 9px; }
          .athlonNavBrandV2 { width: 132px; height: 52px; flex: 0 0 132px; }
          .athlonNavBrandV2 img { width: 122px; height: 48px; }
          .athlonNavLinksV2 { gap: 18px; padding: 2px 0 4px; scrollbar-width: thin; }
          .athlonNavLinksV2 a { font-size: 13px; min-height: 38px; }
          .athlonHeroInnerV2 { width: calc(100% - 30px); }
          .athlonHeroCopyV2 { width: 100%; max-width: none; }
          .athlonHeroButtonsV2 { display: grid; grid-template-columns: 1fr; width: 100%; }
          .athlonHeroButtonsV2 a { width: 100%; min-height: 48px; justify-content: center; }
          .athlonHeroMetaV2 { gap: 12px; }
          .athlonSectionV2 { padding-left: 16px; padding-right: 16px; }
          .athlonSectionHeadingV2 { gap: 12px; align-items: flex-start; flex-direction: column; }
          .athlonQuickGridV2 { grid-template-columns: 1fr; gap: 12px; }
          .athlonQuickCardV2 { padding: 20px; border-radius: 18px; }
          .athlonQuickCardV2 p { max-width: 48ch; }
          .athlonStatsV2 { grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px; }
          .athlonStatsV2 > div { min-width: 0; padding: 14px 10px; }
          .athlonStatsV2 strong { overflow-wrap: anywhere; }
          .athlonFooterV2 { gap: 18px; }
        }
        @media (max-width: 450px) {
          .athlonNavV2 { padding: 8px 10px; }
          .athlonNavBrandV2 { width: 116px; flex-basis: 116px; height: 46px; }
          .athlonNavBrandV2 img { width: 106px; height: 42px; }
          .athlonAdminV2 { min-height: 40px; }
          .athlonHeroV2 { padding-top: 220px; }
          .athlonHeroCopyV2 h1 { font-size: clamp(29px, 8.5vw, 38px); line-height: 1.08; }
          .athlonHeroDescriptionV2 { font-size: 15px; line-height: 1.55; }
          .athlonHeroMetaV2 > span { padding: 10px; font-size: 11px; }
          .athlonHeroMetaV2 > span strong { font-size: 20px; }
          .athlonStatsV2 { grid-template-columns: repeat(2, minmax(0,1fr)); }
          .athlonSectionHeadingV2 h2 { font-size: 29px; }
          .athlonQuickCardV2 h3 { font-size: 21px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .athlonHomeV2 *, .athlonHomeV2 *::before, .athlonHomeV2 *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; transition-duration: .01ms !important; }
        }

        /* SARGAMIYA 2026 HOMEPAGE — STAGE-LIT, RESPONSIVE FESTIVAL THEME */
        .athlonHomeV2 { min-height:100vh; overflow:hidden; color:#f7f8ff; background:#020b21; font-family:Geist,Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
        .athlonNavV2 { height:96px; width:100%; position:relative; z-index:60; display:flex; align-items:center; gap:clamp(14px,2vw,34px); padding:10px clamp(18px,3.1vw,48px); background:linear-gradient(180deg,#04102e 0%,#061b44 100%); border-bottom:1px solid rgba(72,180,255,.25); box-shadow:0 12px 34px rgba(0,0,0,.24); }
        .athlonNavBrandV2 { flex:0 0 clamp(175px,17vw,250px); width:clamp(175px,17vw,250px); height:74px; display:flex; align-items:center; justify-content:flex-start; background:transparent; border-radius:0; padding:0; overflow:visible; }
        .athlonNavBrandV2 img { width:100%; height:100%; object-fit:contain; object-position:left center; filter:brightness(0) invert(1) drop-shadow(0 4px 12px rgba(10,170,255,.2)); }
        .athlonNavLinksV2 { min-width:0; flex:1; display:flex; align-items:center; justify-content:center; gap:clamp(12px,1.65vw,27px); }
        .athlonNavLinksV2 a { min-height:42px; display:inline-flex; align-items:center; justify-content:center; white-space:nowrap; padding:0 2px; text-decoration:none; color:#d7e4ff; font-weight:650; font-size:clamp(12px,.85vw,14px); transition:color .2s,background .2s; }
        .athlonNavLinksV2 a:hover { color:#64eaff; }
        .athlonNavLinksV2 a.active { color:#fff; padding:0 19px; border-radius:25px; background:linear-gradient(115deg,#218aff,#284bff); box-shadow:0 5px 18px rgba(22,104,255,.35); }
        .athlonNavActionsV2 { display:flex; align-items:center; flex:0 0 auto; gap:13px; }
        .athlonEsraBrandV2 { display:flex; align-items:center; gap:7px; flex:0 0 auto; width:auto; height:58px; color:#fff; opacity:.96; }
        .athlonEsraBrandV2 img { display:block; width:43px; height:43px; object-fit:contain; filter:brightness(0) invert(1); }
        .athlonEsraBrandV2 span { display:flex; flex-direction:column; gap:1px; }
        .athlonEsraBrandV2 strong { color:#fff; font-size:32px; line-height:.88; letter-spacing:-.07em; font-weight:900; }
        .athlonEsraBrandV2 small { color:#d0e3ff; font-size:6px; letter-spacing:.12em; font-weight:800; line-height:1.25; }
        .athlonRefreshV2 { display:grid; place-items:center; width:38px; height:38px; color:#b8d7ff; background:rgba(255,255,255,.05); border:1px solid rgba(139,198,255,.26); border-radius:50%; cursor:pointer; }
        .athlonAdminV2 { display:inline-flex; align-items:center; gap:7px; min-height:40px; padding:0 14px; color:#fff; text-decoration:none; border:1px solid rgba(88,181,255,.4); border-radius:22px; background:rgba(7,42,94,.8); font-size:13px; font-weight:750; }
        .athlonMobileMenuButtonV2 { display:none; }
        .athlonHeroV2 { position:relative; min-height:570px; overflow:hidden; color:#fff; background:#020b25; border-bottom:1px solid rgba(64,177,255,.24); }
        .athlonHeroBackgroundV2 { position:absolute; inset:0; background:radial-gradient(ellipse at 73% 23%,rgba(0,155,255,.35),transparent 25%),radial-gradient(ellipse at 83% 50%,rgba(147,39,255,.28),transparent 27%),radial-gradient(ellipse at 22% 66%,rgba(0,91,255,.24),transparent 33%),radial-gradient(ellipse at 50% 100%,rgba(4,171,255,.24),transparent 38%),repeating-linear-gradient(112deg,transparent 0 50px,rgba(255,255,255,.022) 51px 53px,transparent 54px 110px),linear-gradient(115deg,#020821 0%,#061b4b 48%,#10083d 100%); }
        .athlonHeroBackgroundV2::before { content:""; position:absolute; inset:0; opacity:.8; background:radial-gradient(ellipse at 5% 18%,rgba(30,132,255,.44),transparent 18%),radial-gradient(ellipse at 95% 10%,rgba(255,119,45,.25),transparent 18%),linear-gradient(180deg,transparent 66%,rgba(1,6,22,.82) 100%); }
        .athlonHeroBackgroundV2::after { content:""; position:absolute; inset:auto -10% -15% -10%; height:36%; background:repeating-linear-gradient(170deg,transparent 0 23px,rgba(74,196,255,.22) 24px 26px,transparent 27px 55px); transform:perspective(500px) rotateX(54deg); transform-origin:bottom; filter:drop-shadow(0 0 10px #0a9dff); opacity:.72; }
        .athlonHeroShadeV2 { position:absolute; inset:0; background:linear-gradient(90deg,rgba(2,8,30,.84) 0%,rgba(3,12,40,.60) 36%,rgba(3,12,40,.13) 68%,rgba(3,12,40,.2) 100%),linear-gradient(0deg,rgba(2,8,26,.82) 0%,transparent 33%); }
        .athlonHeroInnerV2 { position:relative; z-index:2; width:min(1500px,calc(100% - 60px)); min-height:570px; margin:0 auto; padding:48px 0 24px; display:grid; grid-template-columns:minmax(340px,.88fr) minmax(400px,1.12fr); grid-template-rows:1fr auto; align-items:center; column-gap:18px; }
        .athlonHeroCopyV2 { position:relative; z-index:4; width:100%; max-width:590px; padding:14px 0 74px; align-self:center; }
        .athlonHeroEyebrowV2 { display:flex; align-items:center; flex-wrap:wrap; gap:12px; color:#74edff; font-size:11px; font-weight:900; letter-spacing:.22em; text-transform:uppercase; }
        .athlonHeroEyebrowV2 i { width:6px; height:6px; display:inline-block; border-radius:50%; background:#ffb32d; box-shadow:0 0 12px #ffb32d; }
        .athlonHeroCopyV2 h1 { margin:18px 0 8px; color:#fff; font-size:clamp(58px,6.3vw,98px); line-height:.84; letter-spacing:-.068em; font-weight:1000; text-shadow:0 8px 30px rgba(0,0,0,.22); }
        .athlonHeroTitleLineV2 { display:block; white-space:normal; }
        .athlonHeroCopyV2 h1 strong { display:block; color:#48ddff; font-size:.78em; letter-spacing:.02em; margin-top:10px; text-shadow:0 0 24px rgba(17,162,255,.32); }
        .athlonHeroSublineV2 { margin-top:22px; font-size:clamp(16px,1.4vw,22px); letter-spacing:.34em; font-weight:850; color:#e9f4ff; }
        .athlonHeroDescriptionV2 { max-width:510px; margin:15px 0 12px; color:#eef4ff; font-size:clamp(16px,1.3vw,21px); line-height:1.55; }
        .athlonHeroSloganV2 { margin-top:21px; color:#eaf3ff; letter-spacing:.2em; font-size:clamp(12px,1.1vw,16px); font-weight:850; }
        .athlonHeroSloganV2 strong { color:#ffce4a; }
        .athlonHeroSloganV2 i { padding:0 8px; color:#35dfff; font-style:normal; }
        .athlonHeroTaglineV2 { margin-top:8px; color:#b8d7ff; font-size:12px; letter-spacing:.16em; text-transform:uppercase; }
        .athlonHeroMetaV2 { display:flex; flex-wrap:wrap; gap:0; margin-top:24px; padding-top:14px; border-top:1px solid rgba(130,192,255,.22); }
        .athlonHeroMetaV2 > span { display:flex; align-items:baseline; gap:7px; padding:4px 18px 4px 0; margin-right:18px; color:#c0d7fb; font-size:11px; border-right:1px solid rgba(255,255,255,.16); }
        .athlonHeroMetaV2 > span strong { color:#fff; font-size:18px; }
        .athlonLiveStatusV2 { display:flex; align-items:center; gap:9px; margin-top:16px; color:#9cffe1; font-size:10px; font-weight:900; letter-spacing:.16em; }
        .athlonLiveStatusV2 span { display:block; width:7px; height:7px; border-radius:50%; background:#2cffb2; box-shadow:0 0 12px #2cffb2; }
        .athlonHeroMascotsV2 { position:relative; z-index:3; grid-column:2; grid-row:1; align-self:stretch; width:100%; display:flex; align-items:center; justify-content:center; gap:0; padding:6px 0 25px; pointer-events:none; min-width:0; }
        .athlonMascotCardV2 { position:relative; align-self:center; display:flex; align-items:flex-end; justify-content:center; overflow:visible; border:0; border-radius:0; box-shadow:none; background:transparent; }
        .athlonMascotCardV2 img { position:relative; display:block; width:100%; height:100%; object-fit:contain; filter:drop-shadow(0 16px 28px rgba(0,0,0,.38)); }
        .athlonNovaCardV2 { position:relative; width:45%; height:clamp(330px,38vw,500px); margin-right:-3%; background:transparent; transform:translateY(10px) rotate(-2deg); }
        .athlonNovaCardV2::before { content:"✦"; position:absolute; z-index:3; top:-2%; left:50%; transform:translateX(-50%); color:#fff; font-size:clamp(30px,3vw,46px); text-shadow:0 0 8px #fff,0 0 20px #bda5ff,0 0 36px #7d55ff; pointer-events:none; }
        .athlonNovaCardV2 img { object-position:center bottom; }
        .athlonLumiCardV2 { width:57%; height:clamp(370px,42vw,540px); background:transparent; transform:translateY(23px) rotate(1deg); }
        .athlonLumiCardV2 img { object-position:center bottom; }
        .athlonMascotNameV2 { display:none; }
        .athlonHeroButtonsV2 { position:relative; z-index:5; grid-column:1 / -1; grid-row:2; width:100%; display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; margin:5px 0 0; }
        .athlonHeroButtonsV2 a { min-width:0; min-height:84px; display:flex; align-items:center; justify-content:flex-start; gap:14px; padding:15px 22px; border-radius:17px; text-decoration:none; color:#fff; font-weight:850; font-size:clamp(13px,1vw,16px); border:1px solid rgba(255,255,255,.36); box-shadow:0 15px 32px rgba(0,0,0,.27),inset 0 1px 0 rgba(255,255,255,.18); transition:transform .18s,filter .18s; }
        .athlonHeroButtonsV2 a:hover { transform:translateY(-3px); filter:brightness(1.12); }
        .athlonHeroButtonsV2 a svg:last-child { margin-left:auto; flex:0 0 auto; }
        .athlonHeroButtonsV2 .athlonPrimaryButtonV2 { background:linear-gradient(120deg,#078bff,#0853ef); box-shadow:0 12px 28px rgba(0,105,255,.3); }
        .athlonHeroButtonsV2 .athlonSecondaryButtonV2 { background:linear-gradient(120deg,#ff9d15,#ed7012); }
        .athlonHeroButtonsV2 .athlonSecondaryButtonV2:nth-child(3) { background:linear-gradient(120deg,#853bff,#4e18df); }
        .athlonHeroButtonsV2 .athlonSecondaryButtonV2:nth-child(4) { background:linear-gradient(120deg,#f13f9c,#c01570); }
        .athlonHeroButtonsV2 a span { min-width:0; }
        .athlonDataNoticeV2 { max-width:1450px; margin:14px auto 0; padding:12px 18px; background:#28172d; color:#ffe3f4; border:1px solid rgba(255,119,200,.25); border-radius:12px; }
        .athlonSectionV2 { display:none !important; max-width:1480px; margin:0 auto; padding:40px 30px 24px; }
        .athlonSectionHeadingV2 { display:flex; align-items:end; justify-content:space-between; gap:30px; margin:0 0 22px; }
        .athlonSectionHeadingV2 > div > span,.athlonPanelHeaderV2 > div > span { color:#40dfff; font-size:10px; font-weight:900; letter-spacing:.2em; text-transform:uppercase; }
        .athlonSectionHeadingV2 h2 { margin:8px 0 0; color:#fff; font-size:clamp(27px,3vw,42px); line-height:1.08; letter-spacing:-.04em; }
        .athlonSectionHeadingV2 p { max-width:530px; color:#adc1e5; font-size:14px; line-height:1.7; margin:0; }
        .athlonQuickGridV2 { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
        .athlonQuickCardV2 { min-width:0; position:relative; display:flex; flex-direction:column; padding:20px; color:#f9fbff; border-radius:17px; border:1px solid rgba(79,159,255,.26); background:linear-gradient(145deg,rgba(11,36,84,.95),rgba(5,17,47,.98)); box-shadow:0 12px 24px rgba(0,0,0,.17); text-decoration:none; transition:transform .2s,border-color .2s; }
        .athlonQuickCardV2:hover { transform:translateY(-3px); border-color:#3adfff; }
        .athlonQuickIconV2 { width:44px; height:44px; display:grid; place-items:center; border-radius:13px; color:#7cecff; background:rgba(0,174,255,.13); border:1px solid rgba(71,211,255,.27); }
        .athlonQuickIconV2.green { color:#98ffd6; background:rgba(9,210,152,.12); }
        .athlonQuickIconV2.orange { color:#ffc26a; background:rgba(255,147,27,.12); }
        .athlonQuickIconV2.purple { color:#d1aaff; background:rgba(141,74,255,.13); }
        .athlonQuickIconV2.gold { color:#ffe184; background:rgba(255,197,37,.12); }
        .athlonQuickCardV2 > span { margin-top:16px; color:#4ee5ff; font-size:9px; letter-spacing:.2em; font-weight:900; }
        .athlonQuickCardV2 h3 { margin:7px 0 9px; color:#fff; font-size:19px; line-height:1.2; }
        .athlonQuickCardV2 p { margin:0 0 15px; color:#a9bfdf; font-size:12px; line-height:1.65; }
        .athlonQuickCardV2 > strong { display:flex; gap:7px; align-items:center; margin-top:auto; color:#e5f4ff; font-size:11px; }
        .athlonStatsV2 { display:none !important; }
        .athlonDataGridV2 { max-width:1480px; margin:0 auto; padding:14px 30px 38px; display:grid; grid-template-columns:minmax(0,1.1fr) minmax(0,1fr); gap:16px; }
        .athlonPanelV2 { min-width:0; padding:20px; border:1px solid rgba(47,136,255,.36); border-radius:19px; background:linear-gradient(145deg,rgba(7,28,69,.98),rgba(3,13,39,.99)); box-shadow:0 20px 38px rgba(0,0,0,.22); overflow:hidden; }
        .athlonPanelHeaderV2 { display:flex; align-items:center; justify-content:space-between; gap:15px; margin-bottom:17px; }
        .athlonPanelHeaderV2 h2 { margin:7px 0 0; color:#fff; font-size:21px; letter-spacing:-.025em; }
        .athlonPanelHeaderV2 > a { display:inline-flex; align-items:center; gap:6px; color:#7feaff; text-decoration:none; font-size:11px; font-weight:800; white-space:nowrap; }
        .athlonHomePhotosV2 { display:grid; grid-template-columns:1fr 1fr; grid-template-rows:130px 110px; gap:10px; }
        .athlonHomePhotoV2 { position:relative; display:block; min-width:0; overflow:hidden; border-radius:12px; border:1px solid rgba(255,255,255,.14); background:#0a2450; }
        .athlonHomePhotoV2:first-child { grid-row:1 / span 2; }
        .athlonHomePhotoV2 img { width:100%; height:100%; display:block; object-fit:cover; transition:transform .35s; }
        .athlonHomePhotoV2:hover img { transform:scale(1.05); }
        .athlonHomePhotoV2 span { position:absolute; inset:auto 0 0; padding:24px 10px 9px; color:#fff; font-size:11px; font-weight:800; background:linear-gradient(transparent,rgba(0,5,18,.9)); }
        .athlonHomePhotosEmptyV2 { min-height:230px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:9px; border-radius:14px; border:1px dashed rgba(109,181,255,.35); background:radial-gradient(circle at 50% 25%,rgba(119,45,255,.2),transparent 36%),rgba(1,10,31,.55); color:#b5d0f7; text-decoration:none; text-align:center; }
        .athlonHomePhotosEmptyV2 svg { color:#d47aff; }
        .athlonHomePhotosEmptyV2 strong { color:#fff; font-size:14px; }
        .athlonHomePhotosEmptyV2 span { color:#64e8ff; font-size:11px; }
        .athlonStandingsV2 { display:grid; gap:12px; }
        .athlonStandingRowV2 { display:flex; align-items:center; gap:13px; padding:12px; border:1px solid rgba(81,151,247,.18); border-radius:14px; background:rgba(12,39,86,.5); }
        .athlonRankV2 { color:#83b9ff; font-size:11px; font-weight:900; }
        .athlonHouseBadgeV2 { width:43px; height:43px; display:grid; place-items:center; border-radius:12px; background:rgba(255,255,255,.06); }
        .athlonStandingInfoV2 { flex:1; min-width:0; }
        .athlonStandingInfoV2>div:first-child { display:flex; align-items:center; justify-content:space-between; gap:12px; color:#fff; font-size:13px; }
        .athlonStandingInfoV2>div:first-child span { color:#b8cee9; font-size:11px; }
        .athlonStandingTrackV2 { height:6px; margin-top:9px; border-radius:10px; overflow:hidden; background:#122a53; }
        .athlonStandingTrackV2 span { display:block; height:100%; border-radius:10px; background:linear-gradient(90deg,#22d7ff,#6548ff,#f04cab); }
        .athlonProgrammeV2 { display:grid; gap:8px; }
        .athlonProgrammeRowV2 { display:flex; align-items:center; justify-content:space-between; gap:12px; min-width:0; padding:12px 14px; text-decoration:none; border-radius:12px; border:1px solid rgba(93,157,246,.17); background:rgba(10,36,80,.7); }
        .athlonProgrammeRowV2>div { min-width:0; display:flex; flex-direction:column; gap:4px; }
        .athlonProgrammeRowV2 strong { color:#f5f8ff; font-size:12px; }
        .athlonProgrammeRowV2 span { color:#a7c2e4; font-size:10px; }
        .athlonProgrammeRowV2 small { color:#6de9ff; font-size:9px; font-weight:800; }
        .athlonEmptyV2 { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:140px; gap:8px; color:#bdd2f4; text-align:center; font-size:12px; }
        .athlonProgressV2 { display:none !important; max-width:1420px; margin:0 auto 28px; padding:20px 26px; display:flex; align-items:center; gap:24px; border-radius:16px; border:1px solid rgba(71,139,255,.22); background:linear-gradient(100deg,#071a42,#111148); }
        .athlonProgressIntroV2 { flex:0 0 auto; display:flex; flex-direction:column; gap:4px; }
        .athlonProgressIntroV2>span,.athlonLeaderV2>span { color:#5ce7ff; font-size:9px; letter-spacing:.16em; font-weight:900; }
        .athlonProgressIntroV2>strong { color:white; font-size:24px; }
        .athlonProgressIntroV2 p,.athlonLeaderV2 p { margin:0; color:#afc5e7; font-size:10px; }
        .athlonProgressBarWrapV2 { flex:1; min-width:120px; }
        .athlonProgressBarV2 { height:9px; background:#172d57; border-radius:10px; overflow:hidden; }
        .athlonProgressBarV2 span { display:block; height:100%; background:linear-gradient(90deg,#08caff,#6b47ff,#ef44a5); border-radius:10px; }
        .athlonProgressLabelsV2 { display:flex; justify-content:space-between; gap:12px; margin-top:8px; color:#a4bddf; font-size:10px; }
        .athlonLeaderV2 { display:flex; flex-direction:column; gap:4px; align-items:flex-end; text-align:right; }
        .athlonLeaderV2 strong { color:#fff; font-size:17px; }
        .athlonFooterV2 { padding:24px clamp(20px,3vw,48px); display:flex; align-items:center; justify-content:space-between; gap:22px; border-top:1px solid rgba(78,163,255,.24); background:#03102d; }
        .athlonFooterBrandV2 { display:flex; align-items:center; gap:14px; }
        .athlonFooterLogo { color:#fff; font-size:21px; font-weight:1000; letter-spacing:-.06em; }
        .athlonFooterBrandV2>div:last-child,.athlonFooterMetaV2 { display:flex; flex-direction:column; gap:4px; }
        .athlonFooterBrandV2 strong,.athlonFooterMetaV2 strong { color:#eff8ff; font-size:11px; }
        .athlonFooterBrandV2 span,.athlonFooterMetaV2 span { color:#8faed6; font-size:10px; }
        .athlonFooterMetaV2 { text-align:right; }
        .athlonDisciplineStripV2 { max-width:1480px; margin:0 auto; padding:25px 30px 24px; border-top:1px solid rgba(92,163,255,.16); display:grid; grid-template-columns:repeat(8,minmax(0,1fr)); gap:12px; }
        .athlonDisciplineStripV2>div { display:flex; align-items:center; justify-content:center; flex-direction:column; gap:7px; color:#c6d9fa; text-align:center; }
        .athlonDisciplineStripV2>div svg { color:#a8bfff; stroke-width:1.5; }
        .athlonDisciplineStripV2>div:nth-child(5) svg { color:#ff4fa8; }
        .athlonDisciplineStripV2 span { font-size:8px; font-weight:800; letter-spacing:.08em; }
        .athlonMobileDockV2 { display:none; }
        .athlonSpinV2 { animation:athlonSpin .8s linear infinite; }
        @keyframes athlonSpin { to { transform:rotate(360deg); } }
        @keyframes stageGlow { 0%,100% { opacity:.48; transform:scale(1); } 50% { opacity:.85; transform:scale(1.03); } }
        .athlonHeroBackgroundV2::before { animation:stageGlow 9s ease-in-out infinite; }
        @media (min-width:1500px) { .athlonHeroV2,.athlonHeroInnerV2 { min-height:610px; } .athlonHeroButtonsV2 a { min-height:90px; } }
        @media (max-width:1120px) {
          .athlonNavV2 { gap:12px; padding-inline:18px; }
          .athlonNavBrandV2 { flex-basis:165px; width:165px; }
          .athlonNavLinksV2 { gap:11px; }
          .athlonNavLinksV2 a { font-size:11px; }
          .athlonEsraBrandV2 { display:none; }
          .athlonHeroInnerV2 { width:calc(100% - 44px); grid-template-columns:minmax(300px,.9fr) minmax(330px,1.1fr); }
          .athlonHeroCopyV2 h1 { font-size:clamp(52px,6.8vw,78px); }
          .athlonHeroButtonsV2 a { padding:14px; gap:10px; }
          .athlonDataGridV2,.athlonSectionV2,.athlonDisciplineStripV2 { padding-left:22px; padding-right:22px; }
        }
        @media (max-width:760px) {
          .athlonHomeV2 { padding-bottom:72px; }
          .athlonNavV2 { position:sticky; top:0; height:70px; min-height:70px; padding:8px 15px; justify-content:space-between; gap:10px; background:rgba(3,14,40,.96); backdrop-filter:blur(18px); }
          .athlonNavBrandV2 { flex:0 0 165px; width:165px; height:54px; }
          .athlonMobileMenuButtonV2 { display:grid; flex:0 0 44px; width:44px; height:44px; place-items:center; color:#fff; border:1px solid rgba(93,183,255,.32); border-radius:13px; background:linear-gradient(135deg,#0969ff,#632aff); }
          .athlonNavLinksV2 { display:none; position:absolute; top:calc(100% + 7px); left:12px; right:12px; z-index:100; padding:10px; flex-direction:column; align-items:stretch; justify-content:flex-start; gap:4px; border:1px solid rgba(76,156,255,.38); border-radius:17px; background:rgba(3,13,37,.98); box-shadow:0 24px 50px rgba(0,0,0,.5); }
          .athlonNavLinksV2.isOpen { display:flex; }
          .athlonNavLinksV2 a { justify-content:flex-start; min-height:45px; padding:0 14px; border-radius:10px; font-size:14px; }
          .athlonNavLinksV2 a.active { padding:0 14px; }
          .athlonNavActionsV2 { display:none; }
          .athlonHeroV2 { min-height:0; }
          .athlonHeroShadeV2 { background:linear-gradient(180deg,rgba(1,7,24,.35),rgba(1,7,24,.24) 55%,rgba(1,7,24,.8)); }
          .athlonHeroInnerV2 { width:calc(100% - 28px); min-height:0; display:flex; flex-direction:column; align-items:stretch; padding:25px 0 19px; gap:0; }
          .athlonHeroCopyV2 { width:100%; max-width:none; padding:0; order:0; text-align:center; }
          .athlonHeroEyebrowV2 { justify-content:center; gap:8px; font-size:8px; letter-spacing:.12em; }
          .athlonHeroEyebrowV2 i { width:4px; height:4px; }
          .athlonHeroCopyV2 h1 { margin:17px 0 0; font-size:clamp(47px,12vw,72px); line-height:.86; }
          .athlonHeroCopyV2 h1 strong { margin-top:6px; font-size:.78em; }
          .athlonHeroSublineV2 { margin-top:16px; font-size:13px; letter-spacing:.25em; }
          .athlonHeroDescriptionV2 { margin:10px auto 0; max-width:340px; font-size:14px; line-height:1.45; }
          .athlonHeroSloganV2 { margin-top:14px; font-size:10px; letter-spacing:.12em; }
          .athlonHeroSloganV2 i { padding:0 4px; }
          .athlonHeroTaglineV2 { font-size:8px; letter-spacing:.1em; }
          .athlonHeroMetaV2 { justify-content:center; margin-top:12px; padding-top:10px; }
          .athlonHeroMetaV2>span { margin:0 8px 0 0; padding:4px 9px 4px 0; gap:4px; font-size:9px; }
          .athlonHeroMetaV2>span strong { font-size:14px; }
          .athlonLiveStatusV2 { justify-content:center; margin-top:10px; font-size:9px; }
          .athlonHeroMascotsV2 { width:100%; min-height:0; height:clamp(235px,69vw,350px); flex:0 0 auto; margin-top:0; padding:0; order:1; justify-content:center; align-items:flex-end; }
          .athlonNovaCardV2 { width:44%; height:95%; margin-right:-4%; transform:translateY(-1px) rotate(-2deg); }
          .athlonNovaCardV2::before { top:0; font-size:30px; }
          .athlonLumiCardV2 { width:53%; height:100%; transform:translateY(1px) rotate(1deg); }
          .athlonHeroButtonsV2 { position:relative; inset:auto; width:100%; margin:12px 0 0; order:2; grid-template-columns:1fr 1fr; gap:9px; }
          .athlonHeroButtonsV2 a { min-height:60px; border-radius:13px; padding:10px 12px; gap:8px; justify-content:flex-start; font-size:12px; }
          .athlonHeroButtonsV2 a svg:first-child { width:20px; height:20px; }
          .athlonHeroButtonsV2 a svg:last-child { width:15px; height:15px; }
          .athlonSectionV2 { padding:28px 14px 12px; }
          .athlonSectionHeadingV2 { flex-direction:column; align-items:flex-start; gap:8px; margin-bottom:14px; }
          .athlonSectionHeadingV2 h2 { font-size:28px; }
          .athlonSectionHeadingV2 p { font-size:12px; line-height:1.6; }
          .athlonQuickGridV2 { grid-template-columns:repeat(2,minmax(0,1fr)); gap:9px; }
          .athlonQuickCardV2 { padding:14px; border-radius:14px; }
          .athlonQuickIconV2 { width:36px; height:36px; border-radius:11px; }
          .athlonQuickIconV2 svg { width:18px; height:18px; }
          .athlonQuickCardV2>span { margin-top:12px; font-size:8px; letter-spacing:.11em; }
          .athlonQuickCardV2 h3 { font-size:15px; margin:6px 0; }
          .athlonQuickCardV2 p { font-size:10px; line-height:1.5; margin-bottom:12px; }
          .athlonQuickCardV2>strong { font-size:9px; gap:4px; }
          .athlonDataGridV2 { grid-template-columns:1fr; padding:15px 14px 20px; gap:12px; }
          .athlonPanelV2 { padding:15px; border-radius:16px; }
          .athlonPanelHeaderV2 h2 { font-size:19px; }
          .athlonHomePhotosV2 { grid-template-rows:115px 100px; }
          .athlonProgrammeRowV2 { padding:12px; }
          .athlonProgrammeRowV2 strong { font-size:12px; }
          .athlonProgressV2 { margin:0 14px 22px; padding:16px; flex-wrap:wrap; gap:12px; }
          .athlonProgressIntroV2 { flex:1 0 38%; }
          .athlonProgressBarWrapV2 { flex:1 0 100%; order:3; }
          .athlonLeaderV2 { flex:1 0 48%; align-items:flex-end; }
          .athlonProgressLabelsV2 { font-size:9px; }
          .athlonDisciplineStripV2 { grid-template-columns:repeat(4,minmax(0,1fr)); gap:18px 8px; padding:24px 14px; }
          .athlonDisciplineStripV2>div svg { width:21px; height:21px; }
          .athlonDisciplineStripV2 span { font-size:7px; }
          .athlonFooterV2 { padding:20px 15px 25px; gap:12px; flex-direction:column; align-items:flex-start; }
          .athlonFooterMetaV2 { text-align:left; }
          .athlonMobileDockV2 { position:fixed; z-index:80; left:0; right:0; bottom:0; display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); padding:7px 8px calc(7px + env(safe-area-inset-bottom)); background:rgba(3,13,37,.96); border-top:1px solid rgba(80,175,255,.25); box-shadow:0 -10px 28px rgba(0,0,0,.25); backdrop-filter:blur(18px); }
          .athlonMobileDockV2 a { min-width:0; min-height:49px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; color:#a7c0e3; text-decoration:none; font-size:17px; border-radius:11px; }
          .athlonMobileDockV2 a.selected { color:#48dcff; background:rgba(25,117,255,.13); }
          .athlonMobileDockV2 a span { font-size:22px; line-height:19px; }
          .athlonMobileDockV2 small { font-size:9px; }
          .athlonDataNoticeV2 { margin:12px 14px 0; font-size:12px; }
        }
        @media (max-width:420px) {
          .athlonNavBrandV2 { flex-basis:148px; width:148px; }
          .athlonHeroInnerV2 { width:calc(100% - 22px); padding-top:20px; }
          .athlonHeroEyebrowV2 { font-size:7px; letter-spacing:.1em; }
          .athlonHeroCopyV2 h1 { font-size:clamp(43px,12vw,54px); }
          .athlonHeroSublineV2 { font-size:11px; }
          .athlonHeroDescriptionV2 { font-size:13px; }
          .athlonHeroMascotsV2 { height:clamp(220px,68vw,275px); }
          .athlonHeroButtonsV2 { gap:7px; }
          .athlonHeroButtonsV2 a { min-height:56px; padding:9px; font-size:10px; gap:6px; }
          .athlonQuickCardV2 { padding:12px; }
          .athlonQuickCardV2 h3 { font-size:14px; }
          .athlonQuickCardV2 p { font-size:9px; }
        }
        /* Sargamiya 2026 approved festival hero artwork */
        .athlonHeroV2 { min-height:650px; background:#020821; }
        .athlonHeroBackgroundV2 { background-image:url("/images/sargamiya-hero-2026.png"); background-size:cover; background-position:center center; background-repeat:no-repeat; }
        .athlonHeroBackgroundV2::before, .athlonHeroBackgroundV2::after { display:none; }
        .athlonHeroShadeV2 { background:linear-gradient(0deg,rgba(2,8,26,.72) 0%,rgba(2,8,26,0) 30%); }
        .athlonHeroInnerV2 { min-height:650px; display:flex; flex-direction:column; justify-content:flex-end; align-items:stretch; padding-top:0; }
        .athlonHeroCopyV2, .athlonHeroMascotsV2 { display:none !important; }
        .athlonHeroButtonsV2 { width:100%; margin-top:auto; padding-top:500px; }
        @media (max-width:760px) {
          .athlonHeroV2 { min-height:0; }
          .athlonHeroBackgroundV2 { background-size:100% auto; background-position:center top; background-color:#020821; }
          .athlonHeroShadeV2 { background:linear-gradient(0deg,rgba(2,8,26,.94) 0%,rgba(2,8,26,0) 36%); }
          .athlonHeroInnerV2 { min-height:0; padding:0 0 16px; }
          .athlonHeroButtonsV2 { padding-top:56vw; }
        }
        @media (max-width:420px) { .athlonHeroButtonsV2 { padding-top:55vw; } }
        @media (prefers-reduced-motion: reduce) { .athlonHomeV2 *, .athlonHomeV2 *::before, .athlonHomeV2 *::after { animation:none !important; transition:none !important; scroll-behavior:auto !important; } }
      `}</style>
    </>
  );
}