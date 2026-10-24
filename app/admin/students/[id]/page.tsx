"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Archive,
  CheckCircle2,
  Save,
  UserRound,
} from "lucide-react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Student = {
  id: string;
  admission_no: string | null;
  chest_no: number;
  name: string;
  class_name: string;
  division: string | null;
  category:
    | "Junior Boys"
    | "Junior Girls"
    | "Senior Boys"
    | "Senior Girls";
  gender: string | null;
  house_id: string | null;
  is_active: boolean;
};

type House = {
  id: string;
  name: string;
};

const categories = [
  "Junior Boys",
  "Junior Girls",
  "Senior Boys",
  "Senior Girls",
];

export default function StudentEditorPage() {
  const params = useParams();
  const id = params.id as string;

  const supabase = createClient();

  const [student, setStudent] =
    useState<Student | null>(null);

  const [houses, setHouses] = useState<House[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      const [studentResult, houseResult] =
        await Promise.all([
          supabase
            .from("students")
            .select(
              "id,admission_no,chest_no,name,class_name,division,category,gender,house_id,is_active"
            )
            .eq("id", id)
            .single(),

          supabase
            .from("houses")
            .select("id,name")
            .order("name"),
        ]);

      if (studentResult.error) {
        setError(studentResult.error.message);
      } else {
        setStudent(studentResult.data);
      }

      if (houseResult.error) {
        setError(houseResult.error.message);
      } else {
        setHouses(houseResult.data ?? []);
      }

      setLoading(false);
    }

    load();
  }, [id]);

  function updateField(
    field: keyof Student,
    value: string | number | boolean | null
  ) {
    setStudent((current) =>
      current
        ? {
            ...current,
            [field]: value,
          }
        : current
    );
  }

  async function saveStudent(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!student) return;

    setError("");
    setMessage("");
    setSaving(true);

    const { error } = await supabase
      .from("students")
      .update({
        admission_no: student.admission_no?.trim() || null,
        chest_no: Number(student.chest_no),
        name: student.name.trim(),
        class_name: student.class_name.trim(),
        division:
          student.division?.trim() || null,
        category: student.category,
        gender: student.gender?.trim() || null,
        house_id: student.house_id || null,
        is_active: student.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", student.id);

    if (error) {
      setError(error.message);
    } else {
      setMessage("Student details saved successfully.");
    }

    setSaving(false);
  }

  async function toggleActive() {
    if (!student) return;

    const nextStatus = !student.is_active;

    const confirmed = window.confirm(
      nextStatus
        ? "Reactivate this student?"
        : "Deactivate this student? The student will remain in the database but will no longer be active."
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    const { error } = await supabase
      .from("students")
      .update({
        is_active: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", student.id);

    if (error) {
      setError(error.message);
      return;
    }

    setStudent({
      ...student,
      is_active: nextStatus,
    });

    setMessage(
      nextStatus
        ? "Student reactivated."
        : "Student deactivated."
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
            Loading student...
          </div>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <h1 className="font-bold text-red-800">
              Student not found
            </h1>

            <p className="mt-1 text-sm text-red-700">
              {error ||
                "The requested student could not be loaded."}
            </p>

            <Link
              href="/admin/students"
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            >
              <ArrowLeft size={15} />
              Back to Students
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Link
          href="/admin/students"
          className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft size={16} />
          Back to Students
        </Link>

        <div className="mb-8 flex items-start justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0b1f41] text-white">
              <UserRound size={22} />
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                Student Management
              </p>

              <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#0b1f41]">
                Edit Student
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Chest No. {student.chest_no} ·{" "}
                {student.admission_no || "No admission number"}
              </p>
            </div>
          </div>

          <div
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${
              student.is_active
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                student.is_active
                  ? "bg-emerald-500"
                  : "bg-slate-400"
              }`}
            />

            {student.is_active
              ? "Active"
              : "Inactive"}
          </div>
        </div>

        <form
          onSubmit={saveStudent}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="font-bold text-slate-900">
              Student Information
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Update any of the student's SARGAMIYA register
              details.
            </p>
          </div>

          <div className="grid gap-6 p-6 md:grid-cols-2">
            <Field
              label="Student Name"
              required
              value={student.name}
              onChange={(value) =>
                updateField("name", value)
              }
            />

            <Field
              label="Admission Number"
              value={student.admission_no ?? ""}
              onChange={(value) =>
                updateField("admission_no", value)
              }
            />

            <Field
              label="Chest Number"
              required
              type="number"
              value={String(student.chest_no)}
              onChange={(value) =>
                updateField(
                  "chest_no",
                  Number(value)
                )
              }
            />

            <Field
              label="Class"
              required
              value={student.class_name}
              onChange={(value) =>
                updateField("class_name", value)
              }
            />

            <Field
              label="Division"
              value={student.division ?? ""}
              onChange={(value) =>
                updateField(
                  "division",
                  value || null
                )
              }
            />

            <SelectField
              label="Category"
              required
              value={student.category}
              onChange={(value) =>
                updateField("category", value)
              }
              options={categories}
            />

            <Field
              label="Gender"
              value={student.gender ?? ""}
              onChange={(value) =>
                updateField(
                  "gender",
                  value || null
                )
              }
            />

            <SelectField
              label="House"
              value={student.house_id ?? ""}
              onChange={(value) =>
                updateField(
                  "house_id",
                  value || null
                )
              }
              options={houses.map((house) => ({
                label: house.name,
                value: house.id,
              }))}
            />
          </div>

          {error && (
            <div className="mx-6 mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          {message && (
            <div className="mx-6 mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              {message}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
            <button
              type="button"
              onClick={toggleActive}
              className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition ${
                student.is_active
                  ? "border-red-200 bg-white text-red-600 hover:bg-red-50"
                  : "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
              }`}
            >
              {student.is_active ? (
                <Archive size={16} />
              ) : (
                <CheckCircle2 size={16} />
              )}

              {student.is_active
                ? "Deactivate Student"
                : "Reactivate Student"}
            </button>

            <div className="flex gap-3">
              <Link
                href="/admin/students"
                className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-[#1677f2] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#1266d6] disabled:opacity-60"
              >
                <Save size={16} />

                {saving
                  ? "Saving..."
                  : "Save Changes"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required = false,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
        {label}

        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </span>

      <input
        type={type}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options:
    | string[]
    | { label: string; value: string }[];
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
        {label}

        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </span>

      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
      >
        <option value="">
          Select {label}
        </option>

        {options.map((option) => {
          if (typeof option === "string") {
            return (
              <option
                key={option}
                value={option}
              >
                {option}
              </option>
            );
          }

          return (
            <option
              key={option.value}
              value={option.value}
            >
              {option.label}
            </option>
          );
        })}
      </select>
    </label>
  );
}