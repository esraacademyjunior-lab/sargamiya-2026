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
  ClipboardList,
  Medal,
  RefreshCw,
  Trophy,
  Users,
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
              src="/brand/sargamiya-logo.png"
              alt="Sargamiya Annual Arts Fest"
              width={230}
              height={115}
              priority
            />
          </Link>


          {/* NAVIGATION — CENTER */}

          <nav
            className="athlonNavLinksV2"
            aria-label="Main navigation"
          >
            {NAV_ITEMS.map(
              (item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    item.href === "/"
                      ? "active"
                      : ""
                  }
                >
                  {item.label}
                </Link>
              )
            )}
          </nav>


          {/* ACTIONS — RIGHT */}

          <div className="athlonNavActionsV2">

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

                <span>
                  ESRA GLOBAL SCIENCE ACADEMY
                </span>

                <i />

                <span>
                  ANNUAL ARTS FEST
                </span>

              </div>


              <h1>
                <span className="athlonHeroTitleLineV2">
                  Celebrate Creativity.
                </span>
                <span className="athlonHeroTitleLineV2">
                  <strong>Inspire Expression.</strong>
                </span>
              </h1>


              <p className="athlonHeroDescriptionV2">
                SARGAMIYA 2026 brings every
                event, result and championship
                point together in one live
                arts festival platform.
              </p>


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

              </div>


              {/* HERO METRICS */}

              <div className="athlonHeroMetaV2">

                <span>
                  <strong>
                    3
                  </strong>

                  Houses
                </span>


                <span>
                  <strong>
                    {summary.total_events || 0}
                  </strong>

                  Events
                </span>


                <span>
                  <strong>
                    5–3–1
                  </strong>

                  Individual
                </span>


                <span>
                  <strong>
                    10–6–4
                  </strong>

                  Group Event
                </span>

              </div>


              {/* LIVE STATUS */}

              <div className="athlonLiveStatusV2">

                <span />

                LIVE SARGAMIYA 2026

              </div>

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
                Everything you need,
                <br />
                in one place.
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

          {/* ==================================================
              HOUSE STANDINGS
          ================================================== */}

          <div className="athlonPanelV2">

            <div className="athlonPanelHeaderV2">

              <div>

                <span>
                  CHAMPIONSHIP
                </span>

                <h2>
                  House Standings
                </h2>

              </div>


              <Link
                href="/dashboard"
              >
                View Full Standings
                <ArrowRight
                  size={14}
                />
              </Link>

            </div>


            <div className="athlonStandingsV2">

              {houses.map(
                (
                  house,
                  index
                ) => {

                  const percentage =
                    Math.round(
                      (Number(
                        house.total_points ||
                          0
                      ) /
                        maxPoints) *
                        100
                    );

                  return (
                    <div
                      key={
                        house.house_id
                      }
                      className="athlonStandingRowV2"
                    >

                      <div className="athlonRankV2">
                        {String(
                          index + 1
                        ).padStart(
                          2,
                          "0"
                        )}
                      </div>


                      <div
                        className={`athlonHouseBadgeV2 ${houseClass(
                          house.house
                        )}`}
                      >
                        <HouseLogo
                          house={house.house}
                          size={56}
                        />
                      </div>


                      <div className="athlonStandingInfoV2">

                        <div>

                          <strong>
                            {house.house}
                          </strong>

                          <span>
                            {Number(
                              house.total_points ||
                                0
                            )}{" "}
                            points
                          </span>

                        </div>


                        <div className="athlonStandingTrackV2">

                          <span
                            style={{
                              width:
                                `${percentage}%`,
                            }}
                          />

                        </div>

                      </div>

                    </div>
                  );
                }
              )}

            </div>


            {houses.length === 0 && (
              <div className="athlonEmptyV2">
                House standings will appear
                once championship points are
                recorded.
              </div>
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
                Empowering Students,
                Reshaping Aspirations
              </span>

            </div>

          </div>


          <div className="athlonFooterMetaV2">

            <strong>
              SARGAMIYA 2026
            </strong>

            <span>
              Chasing Limits,
              Creating Legends
            </span>

          </div>

        </footer>

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
          background-image: url("/images/sargamiya-home-hero-canonical.webp");
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

      `}</style>
    </>
  );
}