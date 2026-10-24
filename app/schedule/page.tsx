"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  Radio,
  RefreshCw,
  Trophy,
  Users,
  ArrowRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type ScheduleRow = {
  schedule_id: string;
  event_id: string;
  category: string;
  event_name: string;
  discipline: string;
  format: string;
  scheduled_date: string | null;
  start_time: string | null;
  end_time: string | null;
  venue: string | null;
  notes: string | null;
};

type ParticipantCountRow = {
  event_id: string;
  participant_count: number;
};

type EventStatus = "ongoing" | "upcoming" | "finished";
type StatusFilter = "ongoing" | "upcoming" | "finished" | "all";

const categories = [
  "All Categories",
  "Junior Boys",
  "Junior Girls",
  "Senior Boys",
  "Senior Girls",
];

function formatTime(value: string | null) {
  if (!value) return "Time TBA";

  const parts = value.slice(0, 5).split(":").map(Number);
  const hours = parts[0];
  const minutes = parts[1];

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return "Time TBA";
  }

  const suffix = hours >= 12 ? "PM" : "AM";
  const hour = hours % 12 || 12;

  return `${hour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function formatDate(value: string | null) {
  if (!value) return "Date TBA";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "Date TBA";
  }

  return date.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getScheduleDateTime(
  date: string | null,
  time: string | null
) {
  if (!date || !time) return null;

  const result = new Date(
    `${date}T${time.slice(0, 8)}+05:30`
  );

  return Number.isNaN(result.getTime()) ? null : result;
}

function getEventStatus(
  row: ScheduleRow,
  now: number
): EventStatus {
  const start = getScheduleDateTime(
    row.scheduled_date,
    row.start_time
  );

  const end = getScheduleDateTime(
    row.scheduled_date,
    row.end_time
  );

  if (!start) return "upcoming";

  if (now < start.getTime()) {
    return "upcoming";
  }

  if (!end) {
    return "ongoing";
  }

  if (now < end.getTime()) {
    return "ongoing";
  }

  return "finished";
}

function getUpcomingLabel(
  row: ScheduleRow,
  now: number
) {
  const start = getScheduleDateTime(
    row.scheduled_date,
    row.start_time
  );

  if (!start) return "Schedule TBA";

  const difference = start.getTime() - now;

  if (difference <= 0) {
    return "Starting now";
  }

  const totalMinutes = Math.floor(difference / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `Starts in ${days}d${hours > 0 ? ` ${hours}h` : ""}`;
  }

  if (hours > 0) {
    return `Starts in ${hours}h${minutes > 0 ? ` ${minutes}m` : ""}`;
  }

  return `Starts in ${Math.max(1, minutes)}m`;
}

function statusLabel(status: EventStatus) {
  if (status === "ongoing") return "Ongoing";
  if (status === "finished") return "Finished";
  return "Upcoming";
}

export default function SchedulePage() {
  const supabase = createClient();

  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [participantCounts, setParticipantCounts] =
    useState<Record<string, number>>({});

  const [category, setCategory] = useState("All Categories");
  const [date, setDate] = useState("All Dates");

  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("upcoming");

  const [currentTime, setCurrentTime] =
    useState(() => Date.now());

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async (silent = false) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const [
        scheduleResponse,
        participantResponse,
      ] = await Promise.all([
        supabase
          .from("athlon_public_schedule")
          .select("*")
          .order("scheduled_date", {
            ascending: true,
            nullsFirst: false,
          })
          .order("start_time", {
            ascending: true,
            nullsFirst: false,
          })
          .order("category")
          .order("event_name"),

        supabase
          .from("athlon_public_event_participant_counts")
          .select("event_id,participant_count"),
      ]);

      if (scheduleResponse.error) {
        setError(scheduleResponse.error.message);
      } else {
        setRows(
          (scheduleResponse.data ?? []) as ScheduleRow[]
        );
      }

      if (participantResponse.error) {
        setError(
          participantResponse.error.message
        );
      } else {
        const counts: Record<string, number> = {};

        (
          (participantResponse.data ??
            []) as ParticipantCountRow[]
        ).forEach((row) => {
          counts[row.event_id] = Number(row.participant_count ?? 0);
        });

        setParticipantCounts(counts);
      }

      setLoading(false);
      setRefreshing(false);
      setCurrentTime(Date.now());
    },
    [supabase]
  );

  useEffect(() => {
    load();

    const dataRefreshInterval =
      window.setInterval(() => {
        load(true);
      }, 30000);

    const clockInterval =
      window.setInterval(() => {
        setCurrentTime(Date.now());
      }, 30000);

    return () => {
      window.clearInterval(
        dataRefreshInterval
      );

      window.clearInterval(clockInterval);
    };
  }, [load]);

  const dates = useMemo(() => {
    return Array.from(
      new Set(
        rows
          .map((row) => row.scheduled_date)
          .filter(Boolean) as string[]
      )
    );
  }, [rows]);

  const statusRows = useMemo(() => {
    return rows.map((row) => ({
      row,
      status: getEventStatus(row, currentTime),
    }));
  }, [rows, currentTime]);

  const counts = useMemo(() => {
    return {
      ongoing: statusRows.filter(
        (item) => item.status === "ongoing"
      ).length,

      upcoming: statusRows.filter(
        (item) => item.status === "upcoming"
      ).length,

      finished: statusRows.filter(
        (item) => item.status === "finished"
      ).length,

      all: statusRows.length,
    };
  }, [statusRows]);

  const visible = useMemo(() => {
    const filtered = statusRows.filter(
      ({ row, status }) => {
        const categoryMatch =
          category === "All Categories" ||
          row.category === category;

        const dateMatch =
          date === "All Dates" ||
          row.scheduled_date === date;

        const statusMatch =
          statusFilter === "all" ||
          status === statusFilter;

        return (
          categoryMatch &&
          dateMatch &&
          statusMatch
        );
      }
    );

    const priority: Record<
      EventStatus,
      number
    > = {
      ongoing: 0,
      upcoming: 1,
      finished: 2,
    };

    filtered.sort((a, b) => {
      const statusDifference =
        priority[a.status] -
        priority[b.status];

      if (statusDifference !== 0) {
        return statusDifference;
      }

      const dateA =
        a.row.scheduled_date ??
        "9999-12-31";

      const dateB =
        b.row.scheduled_date ??
        "9999-12-31";

      if (dateA !== dateB) {
        return dateA.localeCompare(dateB);
      }

      const timeA =
        a.row.start_time ?? "99:99:99";

      const timeB =
        b.row.start_time ?? "99:99:99";

      return timeA.localeCompare(timeB);
    });

    return filtered;
  }, [
    statusRows,
    category,
    date,
    statusFilter,
  ]);

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      typeof visible
    >();

    for (const item of visible) {
      const key =
        item.row.scheduled_date ?? "TBA";

      if (!map.has(key)) {
        map.set(key, []);
      }

      map.get(key)!.push(item);
    }

    return Array.from(map.entries());
  }, [visible]);

  return (
    <main className="schedulePortal">
      <header className="resultsTopbar">
        <div className="resultsBrand">
          <Image
            src="/brand/esra-logo.png"
            alt="ESRA Global Science Academy"
            width={205}
            height={60}
            priority
          />

          <span />

          <Image
            src="/brand/sargamiya-logo-placeholder.png"
            alt="Sargamiya 2026 temporary wordmark"
            width={82}
            height={82}
            priority
          />
        </div>

        <nav className="resultsNav">
          <Link href="/results">
            Results
          </Link>

          <Link href="/dashboard">
            House Points
          </Link>

          <Link href="/">
            Home
          </Link>

          <button
            type="button"
            onClick={() => load(true)}
            disabled={refreshing}
          >
            <RefreshCw
              size={15}
              className={
                refreshing ? "spin" : ""
              }
            />
            Refresh
          </button>
        </nav>
      </header>

      <section className="scheduleHero">
        <div>
          <div className="eyebrow">
            SARGAMIYA 2026 · ESRA GLOBAL SCIENCE ACADEMY
          </div>

          <h1>Event Schedule</h1>

          <p>
            Know what is happening, what is next
            and what has already been completed.
          </p>

          <div className="scheduleHeroLinks">
            <Link
              href="/results"
              className="resultsPrimary"
            >
              <Trophy size={17} />
              Official Results
            </Link>

            <span>
              <Clock3 size={15} />
              Programme updates automatically
            </span>
          </div>
        </div>

        <CalendarDays size={82} />
      </section>

      {error && (
        <div className="publicError">
          {error}
        </div>
      )}

      <section className="scheduleStatusNav">
        <button
          type="button"
          className={
            statusFilter === "ongoing"
              ? "statusTab statusTab--ongoing active"
              : "statusTab statusTab--ongoing"
          }
          onClick={() =>
            setStatusFilter("ongoing")
          }
        >
          <span className="statusTabIcon">
            <Radio size={17} />
          </span>

          <span className="statusTabText">
            <strong>Ongoing</strong>
            <small>
              {counts.ongoing}{" "}
              {counts.ongoing === 1
                ? "event"
                : "events"}
            </small>
          </span>
        </button>

        <button
          type="button"
          className={
            statusFilter === "upcoming"
              ? "statusTab statusTab--upcoming active"
              : "statusTab statusTab--upcoming"
          }
          onClick={() =>
            setStatusFilter("upcoming")
          }
        >
          <span className="statusTabIcon">
            <Clock3 size={17} />
          </span>

          <span className="statusTabText">
            <strong>Upcoming</strong>
            <small>
              {counts.upcoming}{" "}
              {counts.upcoming === 1
                ? "event"
                : "events"}
            </small>
          </span>
        </button>

        <button
          type="button"
          className={
            statusFilter === "finished"
              ? "statusTab statusTab--finished active"
              : "statusTab statusTab--finished"
          }
          onClick={() =>
            setStatusFilter("finished")
          }
        >
          <span className="statusTabIcon">
            <CheckCircle2 size={17} />
          </span>

          <span className="statusTabText">
            <strong>Finished</strong>
            <small>
              {counts.finished}{" "}
              {counts.finished === 1
                ? "event"
                : "events"}
            </small>
          </span>
        </button>

        <button
          type="button"
          className={
            statusFilter === "all"
              ? "statusTab statusTab--all active"
              : "statusTab statusTab--all"
          }
          onClick={() =>
            setStatusFilter("all")
          }
        >
          <span className="statusTabIcon">
            <CalendarDays size={17} />
          </span>

          <span className="statusTabText">
            <strong>All Events</strong>
            <small>
              {counts.all}{" "}
              {counts.all === 1
                ? "event"
                : "events"}
            </small>
          </span>
        </button>
      </section>

      <section className="scheduleFilters">
        <select
          value={category}
          onChange={(event) =>
            setCategory(event.target.value)
          }
          aria-label="Filter by category"
        >
          {categories.map((item) => (
            <option key={item}>
              {item}
            </option>
          ))}
        </select>

        <select
          value={date}
          onChange={(event) =>
            setDate(event.target.value)
          }
          aria-label="Filter by date"
        >
          <option value="All Dates">
            All Dates
          </option>

          {dates.map((item) => (
            <option
              value={item}
              key={item}
            >
              {formatDate(item)}
            </option>
          ))}
        </select>

        <span>
          {visible.length}{" "}
          {visible.length === 1
            ? "event"
            : "events"}
        </span>
      </section>

      <section className="scheduleList">
        {loading ? (
          <div className="publicEmpty">
            <RefreshCw
              size={28}
              className="spin"
            />

            <strong>
              Loading programme…
            </strong>
          </div>
        ) : grouped.length === 0 ? (
          <div className="publicEmpty">
            {statusFilter === "ongoing" ? (
              <Radio size={34} />
            ) : statusFilter === "finished" ? (
              <CheckCircle2 size={34} />
            ) : (
              <CalendarDays size={34} />
            )}

            <strong>
              {statusFilter === "ongoing"
                ? "No events are currently ongoing"
                : statusFilter === "finished"
                ? "No events have finished yet"
                : statusFilter === "upcoming"
                ? "No upcoming events"
                : "No schedule entries found"}
            </strong>

            <span>
              {statusFilter === "upcoming"
                ? "Check the filters or return later for the next scheduled events."
                : statusFilter === "ongoing"
                ? "Events will appear here automatically when their scheduled start time arrives."
                : statusFilter === "finished"
                ? "Completed events will appear here automatically after their scheduled end time."
                : "The programme will appear here once events are published."}
            </span>
          </div>
        ) : (
          grouped.map(
            ([dateKey, items]) => (
              <section
                className="scheduleDay"
                key={dateKey}
              >
                <div className="scheduleDayHeader">
                  <div>
                    <div className="eyebrow">
                      SARGAMIYA PROGRAMME
                    </div>

                    <h2>
                      {formatDate(
                        dateKey === "TBA"
                          ? null
                          : dateKey
                      )}
                    </h2>
                  </div>

                  <span>
                    {items.length}{" "}
                    {items.length === 1
                      ? "event"
                      : "events"}
                  </span>
                </div>

                <div className="scheduleCards">
                  {items.map(
                    ({
                      row,
                      status,
                    }) => {
                      const participantCount =
                        participantCounts[
                          row.event_id
                        ] ?? 0;

                      return (
                        <article
                          className={`scheduleCard scheduleCard--${status}`}
                          key={
                            row.schedule_id
                          }
                        >
                          <div className="scheduleTime">
                            <strong>
                              {formatTime(
                                row.start_time
                              )}
                            </strong>

                            {row.end_time && (
                              <small>
                                to{" "}
                                {formatTime(
                                  row.end_time
                                )}
                              </small>
                            )}
                          </div>

                          <div className="scheduleEvent">
                            <div className="scheduleEventMeta">
                              <span>
                                {
                                  row.category
                                }
                              </span>

                              <span>
                                ·
                              </span>

                              <span>
                                {
                                  row.discipline
                                }
                              </span>
                            </div>

                            <h3>
                              {
                                row.event_name
                              }
                            </h3>

                            <small>
                              {row.format}
                            </small>

                            <Link
                              href={`/schedule/${row.event_id}`}
                              className="scheduleParticipantsLink"
                            >
                              <Users
                                size={15}
                              />

                              <span>
                                {participantCount}{" "}
                                {participantCount ===
                                1
                                  ? "Participant"
                                  : "Participants"}
                              </span>

                              <ArrowRight
                                size={15}
                              />
                            </Link>
                          </div>

                          <div
                            className={`scheduleStatus scheduleStatus--${status}`}
                          >
                            {status ===
                              "ongoing" && (
                              <Radio
                                size={15}
                              />
                            )}

                            {status ===
                              "upcoming" && (
                              <Clock3
                                size={15}
                              />
                            )}

                            {status ===
                              "finished" && (
                              <CheckCircle2
                                size={15}
                              />
                            )}

                            <span>
                              {statusLabel(
                                status
                              )}
                            </span>

                            {status ===
                              "upcoming" && (
                              <small>
                                {getUpcomingLabel(
                                  row,
                                  currentTime
                                )}
                              </small>
                            )}
                          </div>

                          <div className="scheduleVenue">
                            <MapPin
                              size={17}
                            />

                            <div>
                              <strong>
                                {row.venue ||
                                  "Venue TBA"}
                              </strong>

                              {row.notes && (
                                <small>
                                  {
                                    row.notes
                                  }
                                </small>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    }
                  )}
                </div>
              </section>
            )
          )
        )}
      </section>

      <footer className="resultsFooter">
        <span>
          SARGAMIYA 2026 · ESRA Global Science Academy
        </span>

        <span>
          Live programme · refreshes automatically
        </span>
      </footer>
    </main>
  );
}