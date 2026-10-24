"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Award,
  Check,
  Download,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Trophy,
  Trash2,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type EligibleResult = {
  result_id: string;
  event_id: string;
  category: string | null;
  discipline: string | null;
  event_name: string;
  event_format: string | null;
  position: number | null;
  result_value: string | null;
  result_unit: string | null;
  points_awarded: number | null;
  participant_name: string | null;
  chest_no: number | null;
  house: string | null;
};

function getAchievement(position: number | null): string {
  switch (position) {
    case 1:
      return "CHAMPION";
    case 2:
      return "RUNNER-UP";
    case 3:
      return "THIRD PLACE";
    default:
      return "—";
  }
}

function getFormatLabel(format: string | null): string {
  switch ((format ?? "").toLowerCase()) {
    case "individual":
      return "Individual";
    case "team":
      return "Group";
    case "relay":
      return "Group";
    default:
      return format || "Event";
  }
}

function getResultText(
  value: string | null,
  unit: string | null
): string {
  if (!value) return "";
  return `${value}${unit ? ` ${unit}` : ""}`;
}

function getDownloadFilename(
  contentDisposition: string | null,
  fallback: string
): string {
  if (!contentDisposition) return fallback;

  const match =
    contentDisposition.match(
      /filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i
    );

  if (!match) return fallback;

  try {
    return decodeURIComponent(match[1] || match[2]);
  } catch {
    return match[2] || fallback;
  }
}

export default function CertificatesPage() {
  /*
   * Keep one browser Supabase client for the lifetime of this page.
   * Using useRef avoids useMemo dependency/type issues and avoids
   * recreating the client on every render.
   */
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);

  if (supabaseRef.current === null) {
    supabaseRef.current = createClient();
  }

  const supabase = supabaseRef.current;

  const [results, setResults] = useState<EligibleResult[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await supabase
        .from("athlon_public_results")
        .select(
          "result_id,event_id,category,discipline,event_name,event_format,position,result_value,result_unit,points_awarded,participant_name,chest_no,house"
        )
        .in("position", [1, 2, 3])
        .order("position", { ascending: true })
        .order("event_name", { ascending: true });

      if (response.error) {
        throw new Error(response.error.message);
      }

      setResults((response.data ?? []) as EligibleResult[]);
    } catch (err) {
      console.error("CERTIFICATES LOAD ERROR:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load eligible results."
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (!needle) {
      return results;
    }

    return results.filter((row) => {
      const searchable = [
        row.participant_name ?? "",
        row.event_name ?? "",
        row.category ?? "",
        row.discipline ?? "",
        row.house ?? "",
        row.chest_no !== null ? String(row.chest_no) : "",
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(needle);
    });
  }, [query, results]);

  const allVisibleSelected =
    filtered.length > 0 &&
    filtered.every((row) => selected.includes(row.result_id));

  const toggleSelected = (resultId: string) => {
    setSelected((current) => {
      if (current.includes(resultId)) {
        return current.filter((id) => id !== resultId);
      }

      return [...current, resultId];
    });
  };

  const toggleVisible = () => {
    const visibleIds = filtered.map((row) => row.result_id);

    if (allVisibleSelected) {
      setSelected((current) =>
        current.filter((id) => !visibleIds.includes(id))
      );
      return;
    }

    setSelected((current) => [
      ...new Set([...current, ...visibleIds]),
    ]);
  };

  const downloadResponse = async (
    response: Response,
    fallbackFilename: string
  ) => {
    const blob = await response.blob();

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = getDownloadFilename(
      response.headers.get("content-disposition"),
      fallbackFilename
    );

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  };

  const generate = async (resultId: string) => {
    setBusy(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/certificates/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ resultId }),
      });

      if (!response.ok) {
        let detail = "Certificate generation failed.";

        try {
          const body = await response.json();
          if (body && typeof body.error === "string") {
            detail = body.error;
          }
        } catch {
          // Response was not JSON.
        }

        throw new Error(detail);
      }

      await downloadResponse(
        response,
        "SARGAMIYA-Certificate.pdf"
      );

      setMessage("Certificate generated successfully.");
    } catch (err) {
      console.error("CERTIFICATE GENERATE ERROR:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Certificate generation failed."
      );
    } finally {
      setBusy(false);
    }
  };

  const deleteCertificate = async (resultId: string) => {
    const confirmed = window.confirm(
      "Delete this certificate? The certificate will be revoked and can no longer be generated or verified."
    );
    if (!confirmed) return;

    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/certificates/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultId }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || "Unable to delete certificate.");
      setMessage("Certificate deleted successfully.");
    } catch (err) {
      console.error("CERTIFICATE DELETE ERROR:", err);
      setError(err instanceof Error ? err.message : "Unable to delete certificate.");
    } finally {
      setBusy(false);
    }
  };

  const bulkGenerate = async () => {
    if (selected.length === 0) {
      return;
    }

    setBusy(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/certificates/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          resultIds: selected,
        }),
      });

      if (!response.ok) {
        let detail = "Bulk certificate generation failed.";

        try {
          const body = await response.json();
          if (body && typeof body.error === "string") {
            detail = body.error;
          }
        } catch {
          // Response was not JSON.
        }

        throw new Error(detail);
      }

      await downloadResponse(
        response,
        "SARGAMIYA-2026-Certificates.zip"
      );

      const count = selected.length;
      setSelected([]);

      setMessage(
        `${count} result${count === 1 ? "" : "s"} processed successfully.`
      );
    } catch (err) {
      console.error("BULK CERTIFICATE ERROR:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Bulk certificate generation failed."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="certPage">
      <div className="certInner">
        <header className="certHeader">
          <div>
            <div className="certEyebrow">
              SARGAMIYA 2026 / CERTIFICATES
            </div>

            <h1>Certificates</h1>

            <p>
              Generate achievement certificates for official podium results.
            </p>
          </div>

          <div className="certActions">
            <button
              type="button"
              className="certButton secondary"
              onClick={() => void load()}
              disabled={loading || busy}
            >
              {loading ? (
                <Loader2 size={16} className="certSpin" />
              ) : (
                <RefreshCw size={16} />
              )}
              {loading ? "Loading..." : "Refresh"}
            </button>

            <button
              type="button"
              className="certButton primary"
              onClick={() => void bulkGenerate()}
              disabled={busy || selected.length === 0}
            >
              {busy ? (
                <Loader2 size={16} className="certSpin" />
              ) : (
                <Download size={16} />
              )}
              Bulk Generate
              {selected.length > 0 ? ` (${selected.length})` : ""}
            </button>
          </div>
        </header>

        <div className="certNotice">
          <ShieldCheck size={16} />
          <span>
            Only official 1st, 2nd and 3rd place results are eligible for
            achievement certificates.
          </span>
        </div>

        {message ? (
          <div className="certSuccess">
            <Check size={16} />
            <span>{message}</span>
          </div>
        ) : null}

        {error ? (
          <div className="certError">
            <span>{error}</span>
          </div>
        ) : null}

        <section className="certToolbar">
          <div className="certSearch">
            <Search size={16} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search participant, event or category..."
              aria-label="Search certificates"
            />
          </div>

          <div className="certCount">
            <Award size={15} />
            {filtered.length} eligible result
            {filtered.length === 1 ? "" : "s"}
          </div>
        </section>

        <section className="certPanel">
          <div className="certTableHead">
            <button
              type="button"
              className="selectAll"
              onClick={toggleVisible}
              aria-label="Select visible results"
              disabled={filtered.length === 0 || busy}
            >
              <span
                className={
                  allVisibleSelected
                    ? "checkBox checked"
                    : "checkBox"
                }
              >
                {allVisibleSelected ? <Check size={12} /> : null}
              </span>
            </button>

            <span>RESULT</span>
            <span>ACHIEVEMENT</span>
            <span>FORMAT</span>
            <span>ACTION</span>
          </div>

          {loading ? (
            <div className="certEmpty">
              <Loader2 size={28} className="certSpin" />
              <strong>Loading eligible results...</strong>
            </div>
          ) : filtered.length === 0 ? (
            <div className="certEmpty">
              <Trophy size={30} />
              <strong>No eligible results</strong>
              <span>
                Official podium results will appear here.
              </span>
            </div>
          ) : (
            filtered.map((row) => {
              const isSelected = selected.includes(row.result_id);
              const resultText = getResultText(
                row.result_value,
                row.result_unit
              );

              return (
                <div
                  className={isSelected ? "certRow selected" : "certRow"}
                  key={row.result_id}
                >
                  <button
                    type="button"
                    className="rowSelect"
                    onClick={() => toggleSelected(row.result_id)}
                    disabled={busy}
                    aria-label={`Select ${
                      row.participant_name || row.event_name
                    }`}
                  >
                    <span
                      className={
                        isSelected
                          ? "checkBox checked"
                          : "checkBox"
                      }
                    >
                      {isSelected ? <Check size={12} /> : null}
                    </span>
                  </button>

                  <div className="resultCell">
                    <strong>{row.event_name}</strong>

                    <span>
                      {row.participant_name || "Team Result"}
                      {" · "}
                      {row.category || "—"}
                      {row.house ? ` · ${row.house}` : ""}
                      {resultText ? ` · ${resultText}` : ""}
                    </span>
                  </div>

                  <div className="achievementPill">
                    {getAchievement(row.position)}
                  </div>

                  <div className="formatCell">
                    <Users size={15} />
                    {getFormatLabel(row.event_format)}
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="generateButton"
                      onClick={() => void generate(row.result_id)}
                      disabled={busy}
                    >
                      {busy ? <Loader2 size={15} className="certSpin" /> : <Download size={15} />}
                      Generate
                    </button>
                    <button
                      type="button"
                      className="generateButton"
                      style={{ color: "#b42318", borderColor: "#f0c5c1", background: "#fff7f6" }}
                      onClick={() => void deleteCertificate(row.result_id)}
                      disabled={busy}
                      title="Delete / revoke certificate"
                    >
                      <Trash2 size={15} />
                      Delete
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </section>
      </div>

      <style jsx>{`
        .certPage {
          min-height: 100vh;
          background: #f4f7fb;
          color: #0b1f41;
        }

        .certInner {
          width: min(100%, 1450px);
          margin: 0 auto;
          padding: 32px 34px 56px;
        }

        .certHeader {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 22px;
        }

        .certEyebrow {
          color: #8b9bb0;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.17em;
        }

        h1 {
          margin: 7px 0 0;
          font-size: 42px;
          line-height: 1;
          letter-spacing: -0.045em;
          font-weight: 900;
        }

        .certHeader p {
          margin: 9px 0 0;
          color: #68778c;
          font-size: 14px;
        }

        .certActions {
          display: flex;
          gap: 9px;
          flex-wrap: wrap;
        }

        .certButton,
        .generateButton {
          min-height: 39px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border-radius: 9px;
          padding: 0 14px;
          font: inherit;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
          transition: 0.16s ease;
        }

        .certButton.secondary {
          background: #fff;
          border: 1px solid #dce4ed;
          color: #52647b;
        }

        .certButton.primary {
          background: #7f8da3;
          border: 1px solid #7f8da3;
          color: #fff;
        }

        .certButton.primary:not(:disabled):hover {
          background: #0b1f41;
          border-color: #0b1f41;
        }

        .certButton:disabled,
        .generateButton:disabled,
        .selectAll:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .certNotice,
        .certSuccess,
        .certError {
          display: flex;
          align-items: center;
          gap: 9px;
          border-radius: 11px;
          padding: 12px 15px;
          margin-bottom: 14px;
          font-size: 12px;
          font-weight: 700;
        }

        .certNotice {
          color: #1454a0;
          background: #eef6ff;
          border: 1px solid #d5e8ff;
        }

        .certSuccess {
          color: #17653b;
          background: #eefaf3;
          border: 1px solid #ccebd9;
        }

        .certError {
          color: #a52828;
          background: #fff1f1;
          border: 1px solid #f2d0d0;
        }

        .certToolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          background: #fff;
          border: 1px solid #e0e6ee;
          border-radius: 13px;
          padding: 13px 15px;
          margin-bottom: 12px;
        }

        .certSearch {
          width: min(520px, 100%);
          display: flex;
          align-items: center;
          gap: 9px;
          border: 1px solid #dce4ed;
          border-radius: 9px;
          padding: 0 12px;
          height: 38px;
          color: #718096;
        }

        .certSearch input {
          width: 100%;
          height: 100%;
          border: 0;
          outline: 0;
          background: transparent;
          color: #0b1f41;
          font: inherit;
          font-size: 12px;
        }

        .certCount {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #718096;
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
        }

        .certPanel {
          overflow: hidden;
          background: #fff;
          border: 1px solid #dfe6ee;
          border-radius: 15px;
        }

        .certTableHead,
        .certRow {
          display: grid;
          grid-template-columns:
            42px
            minmax(280px, 1fr)
            170px
            130px
            130px;
          align-items: center;
        }

        .certTableHead {
          min-height: 42px;
          padding: 0 16px;
          background: #f8fafc;
          border-bottom: 1px solid #e7ecf2;
          color: #93a0b1;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.14em;
        }

        .certRow {
          min-height: 78px;
          padding: 0 16px;
          border-bottom: 1px solid #edf1f5;
          transition: background 0.14s ease;
        }

        .certRow:last-child {
          border-bottom: 0;
        }

        .certRow.selected {
          background: #f7fbff;
        }

        .selectAll,
        .rowSelect {
          border: 0;
          background: transparent;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          cursor: pointer;
        }

        .checkBox {
          width: 18px;
          height: 18px;
          display: grid;
          place-items: center;
          border: 1px solid #cad6e2;
          border-radius: 5px;
          background: #fff;
          color: #fff;
        }

        .checkBox.checked {
          background: #167bf1;
          border-color: #167bf1;
        }

        .resultCell {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .resultCell strong {
          color: #0b1f41;
          font-size: 13px;
          line-height: 1.2;
        }

        .resultCell span {
          color: #7890aa;
          font-size: 10px;
        }

        .achievementPill {
          justify-self: start;
          border-radius: 8px;
          padding: 7px 10px;
          background: #fff6dd;
          color: #ad7600;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.04em;
        }

        .formatCell {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #66788e;
          font-size: 10px;
          font-weight: 700;
        }

        .generateButton {
          min-height: 35px;
          background: #fff;
          border: 1px solid #d6e0eb;
          color: #1671df;
          justify-self: end;
        }

        .generateButton:not(:disabled):hover {
          background: #f2f8ff;
          border-color: #9fc7f4;
        }

        .certEmpty {
          min-height: 280px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 9px;
          color: #8493a6;
        }

        .certEmpty strong {
          color: #53647a;
          font-size: 13px;
        }

        .certEmpty span {
          font-size: 11px;
        }

        .certSpin {
          animation: certSpin 1s linear infinite;
        }

        @keyframes certSpin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 900px) {
          .certInner {
            padding: 22px 16px 40px;
          }

          .certHeader {
            flex-direction: column;
          }

          .certToolbar {
            align-items: stretch;
            flex-direction: column;
          }

          .certSearch {
            width: 100%;
          }

          .certTableHead {
            display: none;
          }

          .certRow {
            grid-template-columns: 34px 1fr;
            gap: 8px;
            padding: 15px;
          }

          .achievementPill,
          .formatCell,
          .generateButton {
            grid-column: 2;
            justify-self: start;
          }
        }
      `}</style>
    </main>
  );
}
