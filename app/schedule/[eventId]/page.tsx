"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  MapPin,
  RefreshCw,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/* ============================================================
   TYPES
============================================================ */

type Event = {
  id: string;
  category: string;
  name: string;
  discipline: string;
  format: "individual" | "team" | "relay";
};

type Schedule = {
  id: string;
  event_id: string;
  scheduled_date: string | null;
  start_time: string | null;
  end_time: string | null;
  venue: string | null;
  notes: string | null;
};

type Participant = {
  id: string;
  name: string;
  admission_no: string;
  chest_no: number | null;
  class_name: string;
  division: string | null;
  house: string;
};

/*
 * This matches the public participant view already used by
 * /schedule for participant counts.
 *
 * We intentionally use the public view here rather than querying
 * students/registrations directly from the public page.
 */
type PublicParticipantRow = {
  event_id: string;
  student_id?: string | null;
  id?: string | null;
  name?: string | null;
  admission_no?: string | null;
  chest_no?: number | null;
  class_name?: string | null;
  division?: string | null;
  house?: string | null;
  student_name?: string | null;
  student_admission_no?: string | null;
  student_chest_no?: number | null;
  student_class_name?: string | null;
  student_division?: string | null;
  house_name?: string | null;
};

/* ============================================================
   HELPERS
============================================================ */

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

function formatTime(value: string | null) {
  if (!value) return "TBA";

  const parts = value.slice(0, 5).split(":").map(Number);

  if (
    parts.length !== 2 ||
    Number.isNaN(parts[0]) ||
    Number.isNaN(parts[1])
  ) {
    return "TBA";
  }

  const hours = parts[0];
  const minutes = parts[1];

  const suffix = hours >= 12 ? "PM" : "AM";
  const hour = hours % 12 || 12;

  return `${hour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function formatRange(
  start: string | null,
  end: string | null
) {
  if (!start && !end) {
    return "Time TBA";
  }

  if (!end) {
    return formatTime(start);
  }

  return `${formatTime(start)} – ${formatTime(end)}`;
}

function formatLabel(
  format: Event["format"]
) {
  if (format === "individual") {
    return "Individual";
  }

  if (format === "relay") {
    return "Group";
  }

  return "Group";
}

/*
 * The public participant view has been used by the schedule page
 * already. Because the exact column naming can vary between the
 * deployed view and an older local migration, this normalizer
 * accepts the common names and converts them to the UI model.
 */
function normalizeParticipant(
  row: PublicParticipantRow,
  index: number
): Participant | null {
  const name =
    row.name ??
    row.student_name ??
    null;

  if (!name) {
    return null;
  }

  return {
    id:
      row.student_id ??
      row.id ??
      `participant-${index}`,
    name,
    admission_no:
      row.admission_no ??
      row.student_admission_no ??
      "—",
    chest_no:
      row.chest_no ??
      row.student_chest_no ??
      null,
    class_name:
      row.class_name ??
      row.student_class_name ??
      "—",
    division:
      row.division ??
      row.student_division ??
      null,
    house:
      row.house ??
      row.house_name ??
      "Unassigned",
  };
}

/* ============================================================
   PAGE
============================================================ */

export default function EventParticipantsPage() {
  const params = useParams();

  const eventId = useMemo(() => {
    const raw = params?.eventId;

    if (Array.isArray(raw)) {
      return raw[0] ?? "";
    }

    return typeof raw === "string" ? raw : "";
  }, [params]);

  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [event, setEvent] =
    useState<Event | null>(null);

  const [schedule, setSchedule] =
    useState<Schedule | null>(null);

  const [participants, setParticipants] =
    useState<Participant[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  /* ==========================================================
     LOAD EVENT
  ========================================================== */

  const load = useCallback(
    async (silent = false) => {
      if (!eventId) {
        setLoading(false);
        setError("Event ID is missing from the URL.");
        return;
      }

      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        /*
         * Validate the route parameter before sending it to
         * Supabase. This prevents UUID errors caused by an
         * undefined or empty parameter.
         */
        const uuidPattern =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

        if (!uuidPattern.test(eventId)) {
          throw new Error(
            "The event link contains an invalid event ID."
          );
        }

        const [
          eventResponse,
          scheduleResponse,
          participantResponse,
        ] = await Promise.all([
          supabase
            .from("events")
            .select(
              "id,category,name,discipline,format"
            )
            .eq("id", eventId)
            .eq("is_active", true)
            .maybeSingle(),

          supabase
            .from("event_schedule")
            .select(
              "id,event_id,scheduled_date,start_time,end_time,venue,notes"
            )
            .eq("event_id", eventId)
            .maybeSingle(),

          /*
           * IMPORTANT:
           * Use the same public participant view that the
           * main schedule page uses for participant counts.
           */
          supabase
            .from("athlon_public_event_participants")
            .select("*")
            .eq("event_id", eventId),
        ]);

        if (eventResponse.error) {
          throw new Error(
            eventResponse.error.message
          );
        }

        if (scheduleResponse.error) {
          throw new Error(
            scheduleResponse.error.message
          );
        }

        if (participantResponse.error) {
          throw new Error(
            participantResponse.error.message
          );
        }

        if (!eventResponse.data) {
          throw new Error(
            "The requested event could not be found."
          );
        }

        const eventData =
          eventResponse.data as Event;

        const participantRows =
          (
            (participantResponse.data ??
              []) as PublicParticipantRow[]
          )
            .map(normalizeParticipant)
            .filter(
              (
                participant
              ): participant is Participant =>
                participant !== null
            );

        /*
         * Sort by chest number when available.
         * Fall back to participant name.
         */
        participantRows.sort((a, b) => {
          if (
            a.chest_no !== null &&
            b.chest_no !== null
          ) {
            return a.chest_no - b.chest_no;
          }

          if (
            a.chest_no !== null &&
            b.chest_no === null
          ) {
            return -1;
          }

          if (
            a.chest_no === null &&
            b.chest_no !== null
          ) {
            return 1;
          }

          return a.name.localeCompare(
            b.name
          );
        });

        setEvent(eventData);

        setSchedule(
          (scheduleResponse.data ??
            null) as Schedule | null
        );

        setParticipants(
          participantRows
        );
      } catch (err) {
        console.error(
          "EVENT PARTICIPANTS LOAD ERROR:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load event information."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [eventId, supabase]
  );

  /* ==========================================================
     INITIAL LOAD
  ========================================================== */

  useEffect(() => {
    if (eventId) {
      void load();
    }
  }, [eventId, load]);

  /* ==========================================================
     LOADING STATE
  ========================================================== */

  if (loading) {
    return (
      <main className="eventParticipantsPage">
        <div className="participantsContainer">
          <div className="loadingState">
            <RefreshCw
              size={24}
              className="spin"
            />

            <strong>
              Loading event…
            </strong>

            <span>
              Getting event and participant
              information.
            </span>
          </div>
        </div>

        <PageStyles />
      </main>
    );
  }

  /* ==========================================================
     ERROR STATE
  ========================================================== */

  if (error || !event) {
    return (
      <main className="eventParticipantsPage">
        <div className="participantsContainer">
          <Link
            href="/schedule"
            className="backLink"
          >
            <ArrowLeft size={16} />
            Back to Schedule
          </Link>

          <section className="errorCard">
            <div className="errorIcon">
              <Trophy size={30} />
            </div>

            <div className="eyebrow">
              SARGAMIYA 2026
            </div>

            <h1>
              Unable to load event
            </h1>

            <p>
              {error ||
                "The requested event could not be found."}
            </p>

            <div className="errorActions">
              <Link
                href="/schedule"
                className="primaryButton"
              >
                View Schedule
              </Link>

              {eventId && (
                <button
                  type="button"
                  className="secondaryButton"
                  onClick={() =>
                    void load()
                  }
                >
                  <RefreshCw size={15} />
                  Try Again
                </button>
              )}
            </div>
          </section>
        </div>

        <PageStyles />
      </main>
    );
  }

  /* ==========================================================
     MAIN PAGE
  ========================================================== */

  return (
    <main className="eventParticipantsPage">
      <div className="participantsContainer">

        {/* HEADER */}
        <header className="pageHeader">
          <div className="headerMain">
            <Link
              href="/schedule"
              className="backLink"
            >
              <ArrowLeft size={16} />
              Back to Schedule
            </Link>

            <div className="eyebrow">
              <Trophy size={13} />
              SARGAMIYA 2026
            </div>

            <h1>{event.name}</h1>

            <p className="eventSubtitle">
              {event.discipline}
              {" · "}
              {event.category}
            </p>
          </div>

          <button
            type="button"
            className="refreshButton"
            onClick={() =>
              void load(true)
            }
            disabled={refreshing}
          >
            <RefreshCw
              size={15}
              className={
                refreshing
                  ? "spin"
                  : ""
              }
            />

            {refreshing
              ? "Refreshing…"
              : "Refresh"}
          </button>
        </header>

        {/* EVENT INFORMATION */}
        <section className="eventInfoCard">
          <div className="eventInfoMain">
            <div className="formatIcon">
              {event.format ===
              "individual" ? (
                <UserRound size={22} />
              ) : (
                <Users size={22} />
              )}
            </div>

            <div className="eventInfoText">
              <span className="sectionLabel">
                EVENT
              </span>

              <h2>{event.name}</h2>

              <div className="badges">
                <span className="badge">
                  {formatLabel(
                    event.format
                  )}
                </span>

                <span className="badge">
                  {event.category}
                </span>

                <span className="badge">
                  {event.discipline}
                </span>
              </div>
            </div>
          </div>

          <div className="eventMeta">
            <div className="metaItem">
              <CalendarDays size={17} />

              <div>
                <span>Date</span>

                <strong>
                  {formatDate(
                    schedule?.scheduled_date ??
                      null
                  )}
                </strong>
              </div>
            </div>

            <div className="metaItem">
              <Clock3 size={17} />

              <div>
                <span>Time</span>

                <strong>
                  {formatRange(
                    schedule?.start_time ??
                      null,
                    schedule?.end_time ??
                      null
                  )}
                </strong>
              </div>
            </div>

            <div className="metaItem">
              <MapPin size={17} />

              <div>
                <span>Venue</span>

                <strong>
                  {schedule?.venue ||
                    "Venue TBA"}
                </strong>
              </div>
            </div>
          </div>

          {schedule?.notes && (
            <div className="scheduleNotes">
              <strong>Note</strong>
              <span>
                {schedule.notes}
              </span>
            </div>
          )}
        </section>

        {/* PARTICIPANTS */}
        <section className="participantsSection">
          <div className="sectionHeader">
            <div>
              <div className="eyebrow">
                REGISTERED PARTICIPANTS
              </div>

              <h2>
                Participants
              </h2>

              <p>
                Students currently registered
                for this event.
              </p>
            </div>

            <div className="participantCount">
              <strong>
                {participants.length}
              </strong>

              <span>
                participant
                {participants.length ===
                1
                  ? ""
                  : "s"}
              </span>
            </div>
          </div>

          {participants.length ===
          0 ? (
            <div className="emptyState">
              <Users size={30} />

              <strong>
                No participants registered yet
              </strong>

              <span>
                Participants will appear here
                once they are registered for
                this event.
              </span>
            </div>
          ) : (
            <div className="participantTableWrap">
              <table className="participantTable">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>
                      Participant
                    </th>
                    <th>
                      Chest No.
                    </th>
                    <th>
                      Class
                    </th>
                    <th>
                      House
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {participants.map(
                    (
                      participant,
                      index
                    ) => (
                      <tr
                        key={
                          participant.id
                        }
                      >
                        <td className="rowNumber">
                          {String(
                            index + 1
                          ).padStart(
                            2,
                            "0"
                          )}
                        </td>

                        <td>
                          <div className="participantIdentity">
                            <div className="participantAvatar">
                              <UserRound
                                size={17}
                              />
                            </div>

                            <div>
                              <strong>
                                {
                                  participant.name
                                }
                              </strong>

                              <span>
                                {
                                  participant.admission_no
                                }
                              </span>
                            </div>
                          </div>
                        </td>

                        <td>
                          <span className="chestBadge">
                            {participant.chest_no ??
                              "—"}
                          </span>
                        </td>

                        <td>
                          {
                            participant.class_name
                          }

                          {participant.division
                            ? ` ${participant.division}`
                            : ""}
                        </td>

                        <td>
                          <span className="houseBadge">
                            {
                              participant.house
                            }
                          </span>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="pageFooter">
          <span>
            SARGAMIYA 2026
          </span>

          <span>
            ESRA Global Science Academy
          </span>

          <span>
            Official participant register
          </span>
        </footer>
      </div>

      <PageStyles />
    </main>
  );
}

/* ============================================================
   SELF-CONTAINED PAGE STYLES
============================================================ */

function PageStyles() {
  return (
    <style>{`
      .eventParticipantsPage {
        min-height: 100vh;
        background: #f6f8fb;
        color: #0b1f41;
      }

      .participantsContainer {
        width: min(
          1180px,
          calc(100% - 40px)
        );
        margin: 0 auto;
        padding: 30px 0 55px;
      }

      .pageHeader {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 25px;
        margin-bottom: 22px;
      }

      .headerMain {
        min-width: 0;
      }

      .backLink {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        margin-bottom: 22px;
        color: #64748b;
        text-decoration: none;
        font-size: 13px;
        font-weight: 800;
      }

      .backLink:hover {
        color: #0b1f41;
      }

      .eyebrow {
        display: flex;
        align-items: center;
        gap: 6px;
        color: #64748b;
        font-size: 10px;
        font-weight: 900;
        letter-spacing: .13em;
        text-transform: uppercase;
      }

      .pageHeader h1 {
        margin: 7px 0 0;
        font-size: clamp(
          32px,
          5vw,
          52px
        );
        line-height: 1;
        letter-spacing: -.045em;
        font-weight: 950;
      }

      .eventSubtitle {
        margin: 10px 0 0;
        color: #64748b;
        font-size: 14px;
        font-weight: 600;
      }

      .refreshButton {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        min-height: 40px;
        padding: 0 13px;
        border: 1px solid #dbe3ee;
        border-radius: 10px;
        background: #fff;
        color: #0b1f41;
        font-size: 12px;
        font-weight: 800;
        cursor: pointer;
      }

      .refreshButton:hover {
        border-color: #0b1f41;
      }

      .refreshButton:disabled {
        opacity: .6;
        cursor: wait;
      }

      .eventInfoCard,
      .participantsSection,
      .errorCard {
        border: 1px solid #e3e9f1;
        border-radius: 20px;
        background: #fff;
        box-shadow:
          0 12px 35px
          rgba(15, 23, 42, .045);
      }

      .eventInfoCard {
        padding: 22px;
      }

      .eventInfoMain {
        display: flex;
        align-items: flex-start;
        gap: 14px;
      }

      .formatIcon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 50px;
        height: 50px;
        flex: 0 0 50px;
        border-radius: 14px;
        background: #eef4ff;
        color: #2563eb;
      }

      .eventInfoText {
        min-width: 0;
      }

      .sectionLabel {
        display: block;
        color: #94a3b8;
        font-size: 9px;
        font-weight: 900;
        letter-spacing: .12em;
        text-transform: uppercase;
      }

      .eventInfoMain h2 {
        margin: 3px 0 8px;
        font-size: 22px;
        letter-spacing: -.025em;
      }

      .badges {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .badge,
      .houseBadge,
      .chestBadge {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 5px 9px;
        background: #f1f5f9;
        color: #475569;
        font-size: 10px;
        font-weight: 800;
      }

      .eventMeta {
        display: grid;
        grid-template-columns:
          repeat(3, 1fr);
        gap: 10px;
        margin-top: 22px;
        padding-top: 20px;
        border-top: 1px solid #edf1f5;
      }

      .metaItem {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        color: #64748b;
      }

      .metaItem svg {
        margin-top: 2px;
        flex: 0 0 auto;
      }

      .metaItem span {
        display: block;
        margin-bottom: 3px;
        color: #94a3b8;
        font-size: 9px;
        font-weight: 900;
        letter-spacing: .08em;
        text-transform: uppercase;
      }

      .metaItem strong {
        display: block;
        color: #0b1f41;
        font-size: 12px;
      }

      .scheduleNotes {
        display: flex;
        gap: 9px;
        margin-top: 16px;
        padding: 12px 14px;
        border-radius: 10px;
        background: #f8fafc;
        color: #64748b;
        font-size: 11px;
      }

      .scheduleNotes strong {
        color: #0b1f41;
      }

      .participantsSection {
        margin-top: 18px;
        overflow: hidden;
      }

      .sectionHeader {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        padding: 22px;
        border-bottom: 1px solid #edf1f5;
      }

      .sectionHeader h2 {
        margin: 5px 0 3px;
        font-size: 24px;
        letter-spacing: -.03em;
      }

      .sectionHeader p {
        margin: 0;
        color: #94a3b8;
        font-size: 11px;
      }

      .participantCount {
        display: flex;
        align-items: baseline;
        gap: 5px;
        padding: 9px 13px;
        border-radius: 10px;
        background: #f8fafc;
        white-space: nowrap;
      }

      .participantCount strong {
        color: #0b1f41;
        font-size: 21px;
        font-weight: 950;
      }

      .participantCount span {
        color: #64748b;
        font-size: 10px;
        font-weight: 800;
      }

      .participantTableWrap {
        overflow-x: auto;
      }

      .participantTable {
        width: 100%;
        border-collapse: collapse;
      }

      .participantTable th {
        padding: 12px 18px;
        background: #f8fafc;
        color: #94a3b8;
        font-size: 9px;
        font-weight: 900;
        letter-spacing: .08em;
        text-align: left;
        text-transform: uppercase;
        white-space: nowrap;
      }

      .participantTable td {
        padding: 14px 18px;
        border-top: 1px solid #edf1f5;
        color: #475569;
        font-size: 12px;
        font-weight: 600;
      }

      .participantTable tbody tr:hover {
        background: #fbfcfe;
      }

      .rowNumber {
        width: 60px;
        color: #94a3b8 !important;
        font-size: 10px !important;
        font-weight: 900 !important;
      }

      .participantIdentity {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 220px;
      }

      .participantAvatar {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        flex: 0 0 34px;
        border-radius: 10px;
        background: #eef4ff;
        color: #2563eb;
      }

      .participantIdentity strong {
        display: block;
        color: #0b1f41;
        font-size: 12px;
        font-weight: 900;
      }

      .participantIdentity span {
        display: block;
        margin-top: 2px;
        color: #94a3b8;
        font-size: 9px;
      }

      .chestBadge {
        min-width: 28px;
        justify-content: center;
        background: #0b1f41;
        color: #fff;
      }

      .houseBadge {
        white-space: nowrap;
      }

      .emptyState,
      .loadingState {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        gap: 7px;
        min-height: 240px;
        padding: 30px;
        color: #94a3b8;
        text-align: center;
      }

      .emptyState strong,
      .loadingState strong {
        color: #475569;
        font-size: 13px;
      }

      .emptyState span,
      .loadingState span {
        max-width: 480px;
        font-size: 11px;
        line-height: 1.6;
      }

      .errorCard {
        display: flex;
        align-items: center;
        flex-direction: column;
        gap: 9px;
        padding: 50px 25px;
        text-align: center;
      }

      .errorIcon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 58px;
        height: 58px;
        margin-bottom: 3px;
        border-radius: 16px;
        background: #eef4ff;
        color: #2563eb;
      }

      .errorCard h1 {
        margin: 4px 0 0;
        font-size: 27px;
        letter-spacing: -.03em;
      }

      .errorCard p {
        max-width: 560px;
        margin: 0 0 10px;
        color: #64748b;
        font-size: 13px;
        line-height: 1.6;
      }

      .errorActions {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
      }

      .primaryButton,
      .secondaryButton {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        min-height: 40px;
        padding: 0 15px;
        border-radius: 10px;
        font-size: 11px;
        font-weight: 900;
        text-decoration: none;
        cursor: pointer;
      }

      .primaryButton {
        border: 1px solid #0b1f41;
        background: #0b1f41;
        color: #fff;
      }

      .secondaryButton {
        border: 1px solid #dbe3ee;
        background: #fff;
        color: #0b1f41;
      }

      .secondaryButton:hover {
        border-color: #0b1f41;
      }

      .pageFooter {
        display: flex;
        justify-content: space-between;
        gap: 15px;
        margin-top: 24px;
        padding: 0 3px;
        color: #94a3b8;
        font-size: 9px;
        font-weight: 800;
        letter-spacing: .06em;
        text-transform: uppercase;
      }

      .spin {
        animation:
          spin .8s linear infinite;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      @media (max-width: 760px) {
        .participantsContainer {
          width: calc(100% - 24px);
          padding-top: 20px;
        }

        .pageHeader {
          align-items: flex-start;
          flex-direction: column;
        }

        .refreshButton {
          width: 100%;
        }

        .eventMeta {
          grid-template-columns: 1fr;
        }

        .sectionHeader {
          align-items: flex-start;
          flex-direction: column;
          padding: 18px;
        }

        .participantCount {
          align-self: stretch;
          justify-content: center;
        }

        .eventInfoCard {
          padding: 18px;
        }

        .eventInfoMain {
          align-items: flex-start;
        }

        .pageFooter {
          flex-direction: column;
        }

        .errorActions {
          width: 100%;
        }

        .primaryButton,
        .secondaryButton {
          width: 100%;
        }
      }

      @media (max-width: 480px) {
        .participantsContainer {
          width: calc(100% - 18px);
        }

        .pageHeader h1 {
          font-size: 34px;
        }

        .formatIcon {
          width: 44px;
          height: 44px;
          flex-basis: 44px;
        }

        .eventInfoMain h2 {
          font-size: 19px;
        }

        .participantTable th,
        .participantTable td {
          padding-left: 12px;
          padding-right: 12px;
        }
      }
    `}</style>
  );
}