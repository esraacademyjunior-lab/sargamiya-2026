"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, CircleAlert, Database, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type EventRow = {
  id: string;
  category: string;
  name: string;
  format: string;
};

export default function SupabaseTestPage() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function testConnection() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("events")
        .select("id, category, name, format")
        .order("category")
        .order("name");

      if (error) {
        setError(error.message);
      } else {
        setEvents(data ?? []);
      }
      setLoading(false);
    }

    testConnection();
  }, []);

  return (
    <main className="shell">
      <header className="pageHeader">
        <div>
          <Link className="backLink" href="/">← Dashboard</Link>
          <div className="eyebrow">SYSTEM / DATABASE</div>
          <h1>Supabase Connection Test</h1>
          <p>Testing the SARGAMIYA event catalogue against the live Supabase database.</p>
        </div>
      </header>

      {loading ? (
        <section className="lookupEmpty">
          <Loader2 size={34} className="spin" />
          <h2>Connecting to Supabase…</h2>
          <p>Reading the SARGAMIYA event catalogue.</p>
        </section>
      ) : error ? (
        <section className="lookupEmpty">
          <CircleAlert size={34} />
          <h2>Connection failed</h2>
          <p>{error}</p>
        </section>
      ) : (
        <>
          <section className="profileCard">
            <div className="profileTop">
              <div className="profileAvatar"><CheckCircle2 size={34} /></div>
              <div className="profileIdentity">
                <div className="eyebrow">DATABASE CONNECTION</div>
                <h2>Supabase Connected</h2>
                <p>Live data is being returned from PostgreSQL.</p>
              </div>
              <div className="houseBadge">{events.length} Events</div>
            </div>
          </section>

          <section className="eventCategory">
            <div className="categoryHeader">
              <div>
                <div className="eyebrow">LIVE DATABASE DATA</div>
                <h2>Event Catalogue</h2>
              </div>
              <span className="categoryCount">{events.length} rows</span>
            </div>

            <div className="eventList">
              {events.map(event => (
                <div className="eventRow" key={event.id}>
                  <span>{event.category} · {event.name}</span>
                  <span className="categoryCount">{event.format}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      <section className="lookupInfo">
        <div>
          <Database size={18} />
          <strong>Source</strong>
          <span>Supabase PostgreSQL</span>
        </div>
        <div>
          <CheckCircle2 size={18} />
          <strong>Expected</strong>
          <span>74 event records</span>
        </div>
      </section>
    </main>
  );
}
