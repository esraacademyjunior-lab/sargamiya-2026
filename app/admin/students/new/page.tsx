"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Save,
  UserPlus,
  Users,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type House = {
  id: string;
  name: string;
};

type Category =
  | "Junior Boys"
  | "Junior Girls"
  | "Senior Boys"
  | "Senior Girls";

type StudentForm = {
  chestNo: string;
  name: string;
  className: string;
  division: string;
  category: Category | "";
  gender: string;
  houseId: string;
};

const CATEGORIES: Category[] = [
  "Junior Boys",
  "Junior Girls",
  "Senior Boys",
  "Senior Girls",
];

const CLASS_OPTIONS = [
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
];

const GENDER_OPTIONS = ["Male", "Female"];

function emptyForm(): StudentForm {
  return {
    chestNo: "",
    name: "",
    className: "",
    division: "",
    category: "",
    gender: "",
    houseId: "",
  };
}

export default function AddStudentPage() {
  const supabase = useMemo(() => createClient(), []);

  const [houses, setHouses] = useState<House[]>([]);
  const [form, setForm] = useState<StudentForm>(emptyForm());

  const [loadingHouses, setLoadingHouses] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadHouses() {
      setLoadingHouses(true);

      const { data, error: houseError } = await supabase
        .from("houses")
        .select("id, name")
        .order("name");

      if (!mounted) return;

      if (houseError) {
        setError(houseError.message);
        setHouses([]);
      } else {
        setHouses((data ?? []) as House[]);
      }

      setLoadingHouses(false);
    }

    void loadHouses();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  function updateField(field: keyof StudentForm, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setError("");
    setMessage("");
  }

  async function validateStudent() {
    setError("");

    const chestNo = Number(form.chestNo);
    const name = form.name.trim();
    const className = form.className.trim();

    if (!form.chestNo.trim()) {
      setError("Chest Number is required.");
      return false;
    }

    if (!Number.isInteger(chestNo) || chestNo <= 0) {
      setError("Chest Number must be a positive whole number.");
      return false;
    }

    if (!name) {
      setError("Student Name is required.");
      return false;
    }

    if (!className) {
      setError("Class is required.");
      return false;
    }

    if (!form.category) {
      setError("Student Category is required.");
      return false;
    }

    // Chest Number is the operational identifier for SARGAMIYA.
    const { data: duplicate, error: duplicateError } = await supabase
      .from("students")
      .select("id, chest_no")
      .eq("chest_no", chestNo)
      .maybeSingle();

    if (duplicateError) {
      setError(duplicateError.message);
      return false;
    }

    if (duplicate) {
      setError(
        `Chest Number "${chestNo}" is already assigned to another student.`
      );
      return false;
    }

    return true;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) return;

    setError("");
    setMessage("");
    setSaving(true);

    try {
      const valid = await validateStudent();

      if (!valid) {
        setSaving(false);
        return;
      }

      const { error: insertError } = await supabase
        .from("students")
        .insert({
          admission_no: null,
          chest_no: Number(form.chestNo),
          name: form.name.trim(),
          class_name: form.className.trim(),
          division: form.division.trim() || null,
          category: form.category,
          gender: form.gender.trim() || null,
          house_id: form.houseId || null,
          is_active: true,
        });

      if (insertError) {
        setError(insertError.message);
        setSaving(false);
        return;
      }

      setMessage(
        `${form.name.trim()} was added successfully to the SARGAMIYA student register.`
      );

      setForm(emptyForm());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to add the student."
      );
    } finally {
      setSaving(false);
    }
  }

  const selectedHouse =
    houses.find((house) => house.id === form.houseId)?.name ?? "";

  const requiredComplete =
    Boolean(
      form.chestNo.trim() &&
        form.name.trim() &&
        form.className.trim() &&
        form.category
    );

  return (
    <main className="addStudentPage">
      <div className="addStudentShell">
        <header className="pageHeader">
          <div className="headerTop">
            <Link href="/admin/students" className="backLink">
              <ArrowLeft size={16} />
              Back to Students
            </Link>

            <span className="pageContext">
              SARGAMIYA 2026 / STUDENT MANAGEMENT
            </span>
          </div>

          <div className="headerContent">
            <div className="titleIcon">
              <UserPlus size={24} />
            </div>

            <div>
              <div className="eyebrow">STUDENT MANAGEMENT</div>
              <h1>Add Student</h1>
              <p>
                Add a student to the SARGAMIYA 2026 student register.
              </p>
            </div>
          </div>
        </header>

        {error && (
          <section className="alert alertError" role="alert">
            <div className="alertIcon">
              <AlertTriangle size={18} />
            </div>
            <div>
              <strong>Unable to save student</strong>
              <p>{error}</p>
            </div>
          </section>
        )}

        {message && (
          <section className="alert alertSuccess" role="status">
            <div className="alertIcon">
              <CheckCircle2 size={18} />
            </div>
            <div>
              <strong>Student added successfully</strong>
              <p>{message}</p>
            </div>
          </section>
        )}

        <div className="workspace">
          <form onSubmit={handleSubmit}>
            <section className="formCard">
              <div className="cardHeader">
                <div>
                  <div className="eyebrow">SECTION 01</div>
                  <h2>Student Information</h2>
                  <p>
                    Enter the official identification details used by
                    SARGAMIYA.
                  </p>
                </div>

                <div className="requiredHint">
                  <span className="requiredDot">*</span>
                  Required
                </div>
              </div>

              <div className="formBody">
                <div className="sectionLabel">
                  <span className="sectionNumber">01</span>
                  Registration Details
                </div>

                <div className="fieldGrid one">
                  <Field
                    label="Chest Number"
                    required
                    type="number"
                    min="1"
                    value={form.chestNo}
                    onChange={(value) =>
                      updateField("chestNo", value)
                    }
                    placeholder="e.g. 101"
                    helper="Unique SARGAMIYA operational identifier"
                  />
                </div>

                <div className="fieldDivider" />

                <div className="sectionLabel">
                  <span className="sectionNumber">02</span>
                  Student Identity
                </div>

                <div className="fieldGrid">
                  <Field
                    label="Student Name"
                    required
                    full
                    value={form.name}
                    onChange={(value) =>
                      updateField("name", value)
                    }
                    placeholder="Enter full student name"
                  />

                  <Field
                    label="Class"
                    required
                    value={form.className}
                    onChange={(value) =>
                      updateField("className", value)
                    }
                    placeholder="Select or enter class"
                    list="class-options"
                  />

                  <Field
                    label="Division"
                    value={form.division}
                    onChange={(value) =>
                      updateField("division", value)
                    }
                    placeholder="e.g. C"
                  />

                  <SelectField
                    label="Category"
                    required
                    value={form.category}
                    onChange={(value) =>
                      updateField("category", value)
                    }
                    options={CATEGORIES}
                    placeholder="Select category"
                  />

                  <SelectField
                    label="Gender"
                    value={form.gender}
                    onChange={(value) =>
                      updateField("gender", value)
                    }
                    options={GENDER_OPTIONS}
                    placeholder="Select gender"
                  />
                </div>

                <div className="fieldDivider" />

                <div className="sectionLabel">
                  <span className="sectionNumber">03</span>
                  House Allocation
                </div>

                <div className="houseAssignment">
                  <div className="houseIcon">
                    <Users size={20} />
                  </div>

                  <div className="houseCopy">
                    <strong>Assign House</strong>
                    <span>
                      House allocation determines the student's
                      championship affiliation.
                    </span>
                  </div>

                  <div className="houseSelect">
                    <select
                      value={form.houseId}
                      onChange={(event) =>
                        updateField(
                          "houseId",
                          event.target.value
                        )
                      }
                      disabled={loadingHouses}
                    >
                      <option value="">
                        {loadingHouses
                          ? "Loading houses..."
                          : "Select house"}
                      </option>

                      {houses.map((house) => (
                        <option key={house.id} value={house.id}>
                          {house.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {selectedHouse && (
                  <div className="housePreview">
                    <div className="previewBadge">
                      {selectedHouse.charAt(0)}
                    </div>
                    <div>
                      <span>Assigned House</span>
                      <strong>{selectedHouse}</strong>
                    </div>
                  </div>
                )}
              </div>

              <div className="formFooter">
                <div className="footerInfo">
                  <span className="requiredDot">*</span>
                  <span>
                    Required fields must be completed before saving.
                  </span>
                </div>

                <div className="footerActions">
                  <Link
                    href="/admin/students"
                    className="button secondary"
                  >
                    Cancel
                  </Link>

                  <button
                    type="submit"
                    className="button primary"
                    disabled={saving || !requiredComplete}
                  >
                    {saving ? (
                      <Loader2 size={17} className="spin" />
                    ) : (
                      <Save size={17} />
                    )}
                    {saving ? "Saving..." : "Add Student"}
                  </button>
                </div>
              </div>
            </section>
          </form>

          <aside className="sidePanel">
            <section className="infoCard">
              <div className="eyebrow">REGISTER WORKFLOW</div>
              <h3>Before you save</h3>

              <div className="workflowItem">
                <span className="workflowNumber">1</span>
                <div>
                  <strong>Verify identifiers</strong>
                  <p>
                    Chest Number must be unique.
                  </p>
                </div>
              </div>

              <div className="workflowItem">
                <span className="workflowNumber">2</span>
                <div>
                  <strong>Confirm category</strong>
                  <p>
                    The category controls eligibility for SARGAMIYA events.
                  </p>
                </div>
              </div>

              <div className="workflowItem">
                <span className="workflowNumber">3</span>
                <div>
                  <strong>Assign a House</strong>
                  <p>
                    House allocation feeds the championship standings.
                  </p>
                </div>
              </div>
            </section>

            <section className="infoCard compact">
              <div className="eyebrow">DATA STATUS</div>

              <div className="statusRow">
                <span>House records</span>
                <strong>
                  {loadingHouses ? "Loading..." : `${houses.length} available`}
                </strong>
              </div>

              <div className="statusRow">
                <span>Register status</span>
                <strong className="activeStatus">
                  Active
                </strong>
              </div>
            </section>
          </aside>
        </div>
      </div>

      <datalist id="class-options">
        {CLASS_OPTIONS.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>

      <style jsx>{`
        .addStudentPage {
          min-height: 100vh;
          background: #f6f8fb;
          color: #0b1f41;
        }

        .addStudentShell {
          width: min(1260px, calc(100% - 48px));
          margin: 0 auto;
          padding: 22px 0 48px;
        }

        .pageHeader {
          margin-bottom: 18px;
        }

        .headerTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 15px;
        }

        .backLink {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #64748b;
          font-size: 13px;
          font-weight: 800;
          text-decoration: none;
          transition: color 0.15s ease;
        }

        .backLink:hover {
          color: #0b1f41;
        }

        .pageContext {
          color: #94a3b8;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.16em;
        }

        .headerContent {
          display: flex;
          align-items: center;
          gap: 13px;
        }

        .titleIcon {
          width: 46px;
          height: 46px;
          flex: 0 0 46px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 15px;
          background: #0b1f41;
          color: white;
          box-shadow: 0 10px 24px rgba(11, 31, 65, 0.13);
        }

        .eyebrow {
          color: #8294ad;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        h1 {
          margin: 3px 0 3px;
          color: #0b1f41;
          font-size: clamp(28px, 3.4vw, 38px);
          line-height: 1;
          letter-spacing: -0.045em;
          font-weight: 950;
        }

        .headerContent p {
          margin: 0;
          color: #7b8798;
          font-size: 12px;
        }

        .alert {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 18px;
          padding: 14px 16px;
          border-radius: 14px;
          border: 1px solid;
        }

        .alertError {
          background: #fff7f7;
          border-color: #fecaca;
          color: #991b1b;
        }

        .alertSuccess {
          background: #f2fbf6;
          border-color: #bbf7d0;
          color: #166534;
        }

        .alertIcon {
          display: flex;
          padding-top: 1px;
        }

        .alert strong {
          display: block;
          font-size: 13px;
          font-weight: 900;
        }

        .alert p {
          margin: 3px 0 0;
          font-size: 12px;
          line-height: 1.55;
        }

        .workspace {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 276px;
          gap: 16px;
          align-items: start;
        }

        .formCard,
        .infoCard {
          overflow: hidden;
          border: 1px solid #e0e6ee;
          border-radius: 15px;
          background: white;
          box-shadow: 0 7px 24px rgba(15, 23, 42, 0.045);
        }

        .cardHeader {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          padding: 18px 21px;
          border-bottom: 1px solid #edf1f5;
        }

        .cardHeader h2 {
          margin: 4px 0 3px;
          color: #0b1f41;
          font-size: 17px;
          letter-spacing: -0.025em;
          font-weight: 950;
        }

        .cardHeader p {
          margin: 0;
          color: #7b8798;
          font-size: 11px;
        }

        .requiredHint {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #94a3b8;
          font-size: 10px;
          font-weight: 800;
          white-space: nowrap;
        }

        .requiredDot {
          color: #ef4444;
          font-weight: 950;
        }

        .formBody {
          padding: 20px 21px 22px;
        }

        .sectionLabel {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
          color: #334155;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .sectionNumber {
          width: 25px;
          height: 25px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: #eef4ff;
          color: #2563eb;
          font-size: 9px;
          font-weight: 950;
        }

        .fieldGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px 18px;
        }

        .fieldGrid.two {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          max-width: 760px;
        }

        .fieldGrid.one {
          grid-template-columns: minmax(0, 1fr);
          max-width: 380px;
        }

        .fieldGrid :global(.field.full) {
          grid-column: 1 / -1;
        }

        .field {
          min-width: 0;
        }

        .fieldLabel {
          display: block;
          margin-bottom: 6px;
          color: #475569;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.04em;
        }

        .fieldControl {
          position: relative;
        }

        .input,
        .select {
          width: 100%;
          min-height: 42px;
          box-sizing: border-box;
          border: 1px solid #d9e1eb;
          border-radius: 10px;
          outline: none;
          background: #fff;
          color: #0f172a;
          padding: 0 13px;
          font: inherit;
          font-size: 13px;
          font-weight: 650;
          transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease,
            background 0.15s ease;
        }

        .input::placeholder {
          color: #a3afbf;
          font-weight: 500;
        }

        .input:hover,
        .select:hover {
          border-color: #b9c6d6;
        }

        .input:focus,
        .select:focus {
          border-color: #4f8ff7;
          box-shadow: 0 0 0 4px rgba(79, 143, 247, 0.10);
        }

        .fieldHelper {
          margin: 5px 0 0;
          color: #94a3b8;
          font-size: 10px;
          line-height: 1.4;
        }

        .fieldDivider {
          height: 1px;
          margin: 20px 0;
          background: #edf1f5;
        }

        .houseAssignment {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) 220px;
          gap: 12px;
          align-items: center;
          padding: 15px;
          border: 1px solid #e5eaf1;
          border-radius: 14px;
          background: #f8fafc;
        }

        .houseIcon {
          width: 42px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          background: #eef4ff;
          color: #2563eb;
        }

        .houseCopy {
          min-width: 0;
        }

        .houseCopy strong {
          display: block;
          color: #0f172a;
          font-size: 13px;
          font-weight: 900;
        }

        .houseCopy span {
          display: block;
          margin-top: 3px;
          color: #7b8798;
          font-size: 11px;
          line-height: 1.4;
        }

        .houseSelect select {
          width: 100%;
          min-height: 42px;
          border: 1px solid #d6deea;
          border-radius: 9px;
          background: white;
          color: #0f172a;
          padding: 0 10px;
          outline: none;
          font: inherit;
          font-size: 12px;
          font-weight: 750;
        }

        .houseSelect select:focus {
          border-color: #4f8ff7;
          box-shadow: 0 0 0 4px rgba(79, 143, 247, 0.10);
        }

        .housePreview {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 12px;
          padding: 10px 12px;
          border-radius: 11px;
          background: #f0fdf4;
          border: 1px solid #dcfce7;
        }

        .previewBadge {
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          background: #0b1f41;
          color: white;
          font-size: 11px;
          font-weight: 950;
        }

        .housePreview span {
          display: block;
          color: #86a092;
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .housePreview strong {
          display: block;
          margin-top: 2px;
          color: #166534;
          font-size: 12px;
          font-weight: 900;
        }

        .formFooter {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding: 13px 21px;
          border-top: 1px solid #edf1f5;
          background: #fafbfc;
        }

        .footerInfo {
          display: flex;
          align-items: center;
          gap: 5px;
          color: #94a3b8;
          font-size: 10px;
          line-height: 1.4;
        }

        .footerActions {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .button {
          min-height: 40px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 15px;
          border-radius: 9px;
          font: inherit;
          font-size: 12px;
          font-weight: 900;
          text-decoration: none;
          cursor: pointer;
          transition:
            transform 0.15s ease,
            box-shadow 0.15s ease,
            background 0.15s ease;
        }

        .button:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .button.secondary {
          border: 1px solid #dbe2ea;
          background: white;
          color: #475569;
        }

        .button.secondary:hover {
          background: #f8fafc;
        }

        .button.primary {
          border: 1px solid #0b1f41;
          background: #0b1f41;
          color: white;
          box-shadow: 0 7px 15px rgba(11, 31, 65, 0.12);
        }

        .button.primary:hover:not(:disabled) {
          background: #102b59;
          box-shadow: 0 9px 19px rgba(11, 31, 65, 0.18);
        }

        .button:disabled {
          cursor: not-allowed;
          opacity: 0.48;
          transform: none;
          box-shadow: none;
        }

        .formCard form {
          min-width: 0;
        }

        .sidePanel {
          display: grid;
          gap: 12px;
        }

        .infoCard {
          padding: 17px;
        }

        .infoCard h3 {
          margin: 4px 0 14px;
          color: #0b1f41;
          font-size: 15px;
          font-weight: 950;
          letter-spacing: -0.02em;
        }

        .workflowItem {
          display: grid;
          grid-template-columns: 25px minmax(0, 1fr);
          gap: 9px;
          padding: 11px 0;
          border-top: 1px solid #eef2f6;
        }

        .workflowItem:first-of-type {
          border-top: 0;
          padding-top: 0;
        }

        .workflowNumber {
          width: 25px;
          height: 25px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: #f1f5f9;
          color: #64748b;
          font-size: 10px;
          font-weight: 950;
        }

        .workflowItem strong {
          display: block;
          color: #334155;
          font-size: 11px;
          font-weight: 900;
        }

        .workflowItem p {
          margin: 3px 0 0;
          color: #94a3b8;
          font-size: 10px;
          line-height: 1.5;
        }

        .infoCard.compact {
          padding: 16px 17px;
        }

        .statusRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 10px 0;
          border-top: 1px solid #eef2f6;
          color: #64748b;
          font-size: 10px;
          font-weight: 700;
        }

        .statusRow:first-of-type {
          margin-top: 9px;
        }

        .statusRow strong {
          color: #334155;
          font-size: 10px;
          font-weight: 900;
        }

        .statusRow .activeStatus {
          color: #15803d;
        }

        .spin {
          animation: spin 0.9s linear infinite;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 980px) {
          .workspace {
            grid-template-columns: 1fr;
          }

          .sidePanel {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 700px) {
          .addStudentShell {
            width: min(100% - 24px, 600px);
            padding-top: 18px;
          }

          .headerTop {
            align-items: flex-start;
            flex-direction: column;
            gap: 10px;
          }

          .pageContext {
            display: none;
          }

          .cardHeader,
          .formBody,
          .formFooter {
            padding-left: 17px;
            padding-right: 17px;
          }

          .fieldGrid,
          .fieldGrid.two,
          .fieldGrid.one {
            grid-template-columns: 1fr;
          }

          .houseAssignment {
            grid-template-columns: auto minmax(0, 1fr);
          }

          .houseSelect {
            grid-column: 1 / -1;
          }

          .formFooter {
            align-items: stretch;
            flex-direction: column;
          }

          .footerActions {
            width: 100%;
          }

          .footerActions .button {
            flex: 1;
          }

          .sidePanel {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  helper,
  required = false,
  full = false,
  type = "text",
  min,
  list,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  helper?: string;
  required?: boolean;
  full?: boolean;
  type?: string;
  min?: string;
  list?: string;
}) {
  return (
    <label className={`field ${full ? "full" : ""}`}>
      <span className="fieldLabel">
        {label}
        {required && <span className="requiredDot"> *</span>}
      </span>

      <span className="fieldControl">
        <input
          className="input"
          type={type}
          min={min}
          list={list}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
        />
      </span>

      {helper && <span className="fieldHelper">{helper}</span>}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder: string;
  required?: boolean;
}) {
  return (
    <label className="field">
      <span className="fieldLabel">
        {label}
        {required && <span className="requiredDot"> *</span>}
      </span>

      <span className="fieldControl">
        <select
          className="select"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">{placeholder}</option>

          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}
