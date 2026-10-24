"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ExcelJS from "exceljs";

import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Edit3,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  UserPlus,
  UserRoundSearch,
  Users,
  X,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";

/* ============================================================
   TYPES
============================================================ */

type Category =
  | "Junior Boys"
  | "Junior Girls"
  | "Senior Boys"
  | "Senior Girls";

type House =
  | "Atlas"
  | "Titan"
  | "Olympus";

type Student = {
  id: string;
  admissionNo: string;
  chestNo: number;
  name: string;
  className: string;
  division: string;
  category: Category;
  gender: string;
  house: House | "";
  isActive: boolean;
};

type ImportRow = Omit<
  Student,
  "id" | "isActive" | "admissionNo"
>;

type StudentForm = {
  chestNo: string;
  name: string;
  className: string;
  division: string;
  category: Category | "";
  gender: string;
  house: House | "";
};

/* ============================================================
   CONSTANTS
============================================================ */

const categories: Category[] = [
  "Junior Boys",
  "Junior Girls",
  "Senior Boys",
  "Senior Girls",
];

const houses: House[] = [
  "Atlas",
  "Titan",
  "Olympus",
];

const columns = [
  "Chest No.",
  "Student Name",
  "Class",
  "Division",
  "Category",
  "Gender",
  "House",
];

/* ============================================================
   HELPERS
============================================================ */

function emptyForm(): StudentForm {
  return {
    chestNo: "",
    name: "",
    className: "",
    division: "",
    category: "",
    gender: "",
    house: "",
  };
}

function value(
  row: Record<string, unknown>,
  names: string[]
) {
  const key = Object.keys(row).find((key) =>
    names.some(
      (name) =>
        key.trim().toLowerCase() ===
        name.toLowerCase()
    )
  );

  return key
    ? String(row[key] ?? "").trim()
    : "";
}

function houseClass(house: House | "") {
  switch (house) {
    case "Atlas":
      return "houseBadge houseAtlas";

    case "Titan":
      return "houseBadge houseTitan";

    case "Olympus":
      return "houseBadge houseOlympus";

    default:
      return "houseBadge";
  }
}

/* ============================================================
   EXCEL TEMPLATE
============================================================ */

async function downloadTemplate() {
  const workbook =
    new ExcelJS.Workbook();

  const worksheet =
    workbook.addWorksheet(
      "Students"
    );

  worksheet.columns =
    columns.map(
      (header, index) => ({
        header,
        key: `column_${index}`,
        width: [
          13,
          28,
          13,
          13,
          18,
          13,
          14,
        ][index],
      })
    );

  worksheet.addRow([
    "101",
    "Mohammed Ammar",
    "VIII",
    "D2",
    "Junior Boys",
    "Male",
    "Atlas",
  ]);

  worksheet.addRow([
    "102",
    "Fathima Zahra",
    "VIII",
    "C1",
    "Junior Girls",
    "Female",
    "Titan",
  ]);

  worksheet.getRow(1).font = {
    bold: true,
  };

  worksheet.autoFilter = {
    from: "A1",
    to: "G1",
  };

  const buffer =
    await workbook.xlsx.writeBuffer();

  const blob = new Blob(
    [buffer],
    {
      type:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }
  );

  const url =
    URL.createObjectURL(blob);

  const anchor =
    document.createElement("a");

  anchor.href = url;
  anchor.download =
    "Sargamiya_2026_Student_Template.xlsx";

  anchor.click();

  URL.revokeObjectURL(url);
}

/* ============================================================
   PAGE
============================================================ */

export default function StudentsPage() {
  const supabase = useMemo(
    () => createClient(),
    []
  );

  /* ----------------------------------------------------------
     DATA
  ---------------------------------------------------------- */

  const [students, setStudents] =
    useState<Student[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  /* ----------------------------------------------------------
     FILTERS
  ---------------------------------------------------------- */

  const [search, setSearch] =
    useState("");

  const [category, setCategory] =
    useState<
      "All" | Category
    >("All");

  const [house, setHouse] =
    useState<
      "All" | House
    >("All");

  const [status, setStatus] =
    useState<
      "All" | "Active" | "Inactive"
    >("Active");

  /* ----------------------------------------------------------
     EXCEL IMPORT
  ---------------------------------------------------------- */

  const [importOpen, setImportOpen] =
    useState(false);

  const [preview, setPreview] =
    useState<ImportRow[]>([]);

  const [errors, setErrors] =
    useState<string[]>([]);

  const [importing, setImporting] =
    useState(false);

  /* ----------------------------------------------------------
     EDIT STUDENT
  ---------------------------------------------------------- */

  const [formOpen, setFormOpen] =
    useState(false);

  const [editingStudent, setEditingStudent] =
    useState<Student | null>(null);

  const [form, setForm] =
    useState<StudentForm>(
      emptyForm()
    );

  const [saving, setSaving] =
    useState(false);

  const [formError, setFormError] =
    useState("");

  /* ----------------------------------------------------------
     REMOVE / RESTORE
  ---------------------------------------------------------- */

  const [actionStudent, setActionStudent] =
    useState<Student | null>(null);

  const [actionLoading, setActionLoading] =
    useState(false);

  /* ============================================================
     LOAD STUDENTS
  ============================================================ */

  async function loadStudents() {
    setLoading(true);
    setError("");

    const {
      data,
      error: queryError,
    } = await supabase
      .from("students")
      .select(
        `
        id,
        admission_no,
        chest_no,
        name,
        class_name,
        division,
        category,
        gender,
        is_active,
        houses(name)
        `
      )
      .order("chest_no");

    if (queryError) {
      setError(
        queryError.message
      );
      setStudents([]);
      setLoading(false);
      return;
    }

    const mapped =
      (data ?? []).map(
        (student: any) => ({
          id: student.id,

          admissionNo:
            student.admission_no ?? "",

          chestNo:
            Number(
              student.chest_no
            ),

          name:
            student.name,

          className:
            student.class_name,

          division:
            student.division ?? "",

          category:
            student.category,

          gender:
            student.gender ?? "",

          house:
            student.houses?.name ?? "",

          isActive:
            Boolean(
              student.is_active
            ),
        })
      );

    setStudents(mapped);
    setLoading(false);
  }

  useEffect(() => {
    void loadStudents();
  }, []);

  /* ============================================================
     FILTERED STUDENTS
  ============================================================ */

  const filtered =
    useMemo(() => {
      const query =
        search
          .toLowerCase()
          .trim();

      return students.filter(
        (student) => {
          const matchesSearch =
            !query ||
            [
              student.admissionNo,
              student.chestNo,
              student.name,
              student.className,
              student.division,
              student.category,
              student.gender,
              student.house,
            ]
              .join(" ")
              .toLowerCase()
              .includes(query);

          const matchesCategory =
            category === "All" ||
            student.category ===
              category;

          const matchesHouse =
            house === "All" ||
            student.house ===
              house;

          const matchesStatus =
            status === "All" ||
            (status === "Active" &&
              student.isActive) ||
            (status === "Inactive" &&
              !student.isActive);

          return (
            matchesSearch &&
            matchesCategory &&
            matchesHouse &&
            matchesStatus
          );
        }
      );
    }, [
      students,
      search,
      category,
      house,
      status,
    ]);

  /* ============================================================
     EDIT FORM
  ============================================================ */

  function openEditForm(
    student: Student
  ) {
    setEditingStudent(
      student
    );

    setForm({
      chestNo:
        String(
          student.chestNo
        ),

      name:
        student.name,

      className:
        student.className,

      division:
        student.division,

      category:
        student.category,

      gender:
        student.gender,

      house:
        student.house,
    });

    setFormError("");
    setMessage("");
    setFormOpen(true);
  }

  function updateForm(
    field: keyof StudentForm,
    fieldValue: string
  ) {
    setForm(
      (previous) => ({
        ...previous,
        [field]:
          fieldValue,
      })
    );
  }

  /* ============================================================
     VALIDATE EDIT
  ============================================================ */

  async function validateStudent() {
    setFormError("");

    const chestNo =
      Number(
        form.chestNo
      );

    if (
      !form.chestNo.trim()
    ) {
      setFormError(
        "Chest Number is required."
      );
      return false;
    }

    if (
      !Number.isInteger(
        chestNo
      ) ||
      chestNo <= 0
    ) {
      setFormError(
        "Chest Number must be a positive whole number."
      );
      return false;
    }

    if (
      !form.name.trim()
    ) {
      setFormError(
        "Student Name is required."
      );
      return false;
    }

    if (
      !form.className.trim()
    ) {
      setFormError(
        "Class is required."
      );
      return false;
    }

    if (!form.category) {
      setFormError(
        "Student Category is required."
      );
      return false;
    }

    let chestQuery = supabase
      .from("students")
      .select("id, chest_no")
      .eq("chest_no", chestNo);

    if (editingStudent) {
      chestQuery = chestQuery.neq("id", editingStudent.id);
    }

    const { data: chestDuplicates, error: chestError } =
      await chestQuery;

    if (chestError) {
      setFormError(chestError.message);
      return false;
    }

    if ((chestDuplicates ?? []).length > 0) {
      setFormError(
        `Chest Number "${chestNo}" is already assigned to another student.`
      );
      return false;
    }

    return true;
  }

  /* ============================================================
     SAVE EDITED STUDENT
  ============================================================ */

  async function saveStudent() {
    if (!editingStudent) {
      return;
    }

    setSaving(true);
    setFormError("");
    setMessage("");

    const valid =
      await validateStudent();

    if (!valid) {
      setSaving(false);
      return;
    }

    let houseId:
      | string
      | null = null;

    if (form.house) {
      const {
        data: houseRow,
        error: houseError,
      } =
        await supabase
          .from("houses")
          .select("id")
          .eq(
            "name",
            form.house
          )
          .single();

      if (houseError) {
        setFormError(
          houseError.message
        );
        setSaving(false);
        return;
      }

      houseId =
        houseRow?.id ??
        null;
    }

    const payload = {
      chest_no:
        Number(
          form.chestNo
        ),

      name:
        form.name.trim(),

      class_name:
        form.className.trim(),

      division:
        form.division.trim() ||
        null,

      category:
        form.category,

      gender:
        form.gender.trim() ||
        null,

      house_id:
        houseId,
    };

    const {
      error: updateError,
    } =
      await supabase
        .from("students")
        .update(payload)
        .eq(
          "id",
          editingStudent.id
        );

    if (updateError) {
      setFormError(
        updateError.message
      );
      setSaving(false);
      return;
    }

    setMessage(
      `${form.name.trim()} has been updated successfully.`
    );

    setFormOpen(false);
    setEditingStudent(null);
    setForm(emptyForm());

    await loadStudents();

    setSaving(false);
  }

  /* ============================================================
     REMOVE / RESTORE STUDENT
  ============================================================ */

  async function changeStudentStatus() {
    if (!actionStudent) {
      return;
    }

    setActionLoading(true);
    setError("");
    setMessage("");

    const nextStatus =
      !actionStudent.isActive;

    const {
      error: updateError,
    } =
      await supabase
        .from("students")
        .update({
          is_active:
            nextStatus,
        })
        .eq(
          "id",
          actionStudent.id
        );

    if (updateError) {
      setError(
        updateError.message
      );
      setActionLoading(false);
      return;
    }

    setMessage(
      nextStatus
        ? `${actionStudent.name} has been restored to the active register.`
        : `${actionStudent.name} has been removed from the active register.`
    );

    setActionStudent(null);

    await loadStudents();

    setActionLoading(false);
  }

  /* ============================================================
     PARSE EXCEL
  ============================================================ */

  async function parseFile(
    file: File
  ) {
    setErrors([]);
    setMessage("");

    try {
      const workbook =
        new ExcelJS.Workbook();

      await workbook.xlsx.load(
        await file.arrayBuffer()
      );

      const worksheet =
        workbook.worksheets[0];

      if (!worksheet) {
        throw new Error(
          "The workbook has no worksheet."
        );
      }

      const headers: string[] =
        [];

      worksheet
        .getRow(1)
        .eachCell(
          (
            cell,
            columnNumber
          ) => {
            headers[
              columnNumber
            ] = String(
              cell.value ?? ""
            ).trim();
          }
        );

      const rows: ImportRow[] =
        [];

      const validationErrors: string[] =
        [];

      for (
        let rowNumber = 2;
        rowNumber <=
        worksheet.rowCount;
        rowNumber++
      ) {
        const row =
          worksheet.getRow(
            rowNumber
          );

        const record: Record<
          string,
          unknown
        > = {};

        row.eachCell(
          (
            cell,
            columnNumber
          ) => {
            const header =
              headers[
                columnNumber
              ];

            if (header) {
              record[
                header
              ] = cell.value;
            }
          }
        );

        const chestNo =
          value(
            record,
            [
              "Chest No.",
              "Chest No",
              "Chest Number",
              "Chest",
            ]
          );

        const name =
          value(
            record,
            [
              "Student Name",
              "Student",
              "Name",
            ]
          );

        const className =
          value(
            record,
            [
              "Class",
              "Class Name",
            ]
          );

        const division =
          value(
            record,
            [
              "Division",
              "Div",
            ]
          );

        const categoryValue =
          value(
            record,
            [
              "Category",
            ]
          );

        const gender =
          value(
            record,
            [
              "Gender",
            ]
          );

        const houseValue =
          value(
            record,
            [
              "House",
              "House Name",
            ]
          );

        const hasNoData =
          !chestNo &&
          !name &&
          !className &&
          !division &&
          !categoryValue &&
          !gender &&
          !houseValue;

        if (hasNoData) {
          continue;
        }

        const parsedChest =
          Number(
            chestNo
          );

        if (
          !Number.isInteger(
            parsedChest
          ) ||
          parsedChest <= 0
        ) {
          validationErrors.push(
            `Row ${rowNumber}: Chest Number must be a positive whole number.`
          );
          continue;
        }

        if (!name) {
          validationErrors.push(
            `Row ${rowNumber}: Student Name is required.`
          );
          continue;
        }

        if (!className) {
          validationErrors.push(
            `Row ${rowNumber}: Class is required.`
          );
          continue;
        }

        if (
          !categories.includes(
            categoryValue as Category
          )
        ) {
          validationErrors.push(
            `Row ${rowNumber}: Invalid category "${categoryValue}".`
          );
          continue;
        }

        if (
          houseValue &&
          !houses.includes(
            houseValue as House
          )
        ) {
          validationErrors.push(
            `Row ${rowNumber}: Invalid house "${houseValue}".`
          );
          continue;
        }

        rows.push({
          chestNo:
            parsedChest,
          name,
          className,
          division,
          category:
            categoryValue as Category,
          gender,
          house:
            houseValue as
              | House
              | "",
        });
      }

      setErrors(
        validationErrors
      );

      setPreview(rows);

      if (
        rows.length === 0 &&
        validationErrors.length === 0
      ) {
        setErrors([
          "No student records were found in the worksheet.",
        ]);
      }
    } catch (parseError: any) {
      setErrors([
        parseError?.message ??
          "Unable to read the Excel file.",
      ]);

      setPreview([]);
    }
  }

  /* ============================================================
     IMPORT STUDENTS
  ============================================================ */

  async function importStudents() {
    if (preview.length === 0) {
      return;
    }

    // Bulk import must run with the Supabase Auth session used by the admin area.
    const { data: authData, error: authError } = await supabase.auth.getSession();
    if (authError || !authData.session) {
      setErrors([
        "Your Supabase admin session is not available in this browser. Sign out, sign in again through the Sargamiya admin login, and retry the import.",
      ]);
      return;
    }

    setImporting(true);
    setErrors([]);
    setMessage("");

    const importErrors: string[] =
      [];

    let importedCount = 0;

    for (
      let index = 0;
      index < preview.length;
      index++
    ) {
      const student =
        preview[index];

      let houseId:
        | string
        | null = null;

      if (student.house) {
        const {
          data: houseRow,
          error: houseError,
        } =
          await supabase
            .from("houses")
            .select("id")
            .eq(
              "name",
              student.house
            )
            .single();

        if (houseError) {
          importErrors.push(
            `${student.name}: ${houseError.message}`
          );
          continue;
        }

        houseId =
          houseRow?.id ??
          null;
      }

      const payload = {
        admission_no: null,
        chest_no:
          student.chestNo,

        name:
          student.name,

        class_name:
          student.className,

        division:
          student.division ||
          null,

        category:
          student.category,

        gender:
          student.gender ||
          null,

        house_id:
          houseId,

        is_active:
          true,
      };

      const {
        error: insertError,
      } =
        await supabase
          .from("students")
          .insert(
            payload
          );

      if (insertError) {
        const message = insertError.message.toLowerCase();
        if (
          message.includes("row-level security") ||
          message.includes("row level security") ||
          (message.includes("permission denied") && message.includes("students"))
        ) {
          importErrors.push(
            "Import stopped because Supabase blocked student inserts with Row Level Security. Run supabase/student-import-rls.sql in the Supabase SQL Editor, then sign out and sign in again. Keep RLS enabled; do not add public/anon insert access."
          );
          break;
        }
        importErrors.push(
          `${student.name}: ${insertError.message}`
        );
        continue;
      }

      importedCount++;
    }

    if (
      importErrors.length > 0
    ) {
      setErrors(
        importErrors
      );
    }

    if (
      importedCount > 0
    ) {
      setMessage(
        `${importedCount} student${
          importedCount === 1
            ? ""
            : "s"
        } imported successfully.`
      );
    }

    setImporting(false);

    await loadStudents();

    if (
      importErrors.length === 0
    ) {
      setPreview([]);
      setImportOpen(false);
    }
  }

  /* ============================================================
     RESET IMPORT
  ============================================================ */

  function closeImport() {
    if (importing) {
      return;
    }

    setImportOpen(false);
    setPreview([]);
    setErrors([]);
  }

  /* ============================================================
     SUMMARY
  ============================================================ */

  const activeCount =
    students.filter(
      (student) =>
        student.isActive
    ).length;

  const inactiveCount =
    students.filter(
      (student) =>
        !student.isActive
    ).length;

  /* ============================================================
     PAGE
  ============================================================ */

  return (
    <main className="adminPage">
      {/* ======================================================
          PAGE HEADER
      ======================================================= */}

      <header className="pageHeader">
        <div>
          <div className="eyebrow">
            SARGAMIYA 2026 / STUDENT MANAGEMENT
          </div>

          <h1>
            Students
          </h1>

          <p>
            Manage the SARGAMIYA student
            register, house allocation
            and participant information.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
            justifyContent:
              "flex-end",
          }}
        >
          <Link
            href="/admin/students/lookup"
            className="secondaryButton"
          >
            <UserRoundSearch
              size={17}
            />
            Chest Lookup
          </Link>

          <button
            className="secondaryButton"
            onClick={() => {
              void downloadTemplate();
            }}
          >
            <Download
              size={17}
            />
            Template
          </button>

          <button
            className="secondaryButton"
            onClick={() => {
              setImportOpen(true);
              setErrors([]);
              setPreview([]);
            }}
          >
            <Upload
              size={17}
            />
            Import Excel
          </button>

          <Link
            href="/admin/students/new"
            className="primaryButton"
          >
            <UserPlus
              size={17}
            />
            Add Student
          </Link>
        </div>
      </header>

      {/* ======================================================
          ALERTS
      ======================================================= */}

      {message && (
        <div className="successBox">
          <CheckCircle2
            size={17}
          />
          <span>
            {message}
          </span>
        </div>
      )}

      {error && (
        <div className="errorBox">
          <AlertTriangle
            size={17}
          />

          <div>
            <strong>
              Unable to load students
            </strong>

            <div>
              {error}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================
          SUMMARY
      ======================================================= */}

      <section
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(3, minmax(0, 1fr))",
          gap: "14px",
          marginBottom: "18px",
        }}
      >
        <div className="statCard">
          <div className="statIcon">
            <Users size={20} />
          </div>

          <div>
            <div className="statValue">
              {students.length}
            </div>

            <div className="statLabel">
              Total Students
            </div>
          </div>
        </div>

        <div className="statCard">
          <div
            className="statIcon"
            style={{
              background:
                "#ecfdf5",
              color:
                "#15803d",
            }}
          >
            <CheckCircle2
              size={20}
            />
          </div>

          <div>
            <div className="statValue">
              {activeCount}
            </div>

            <div className="statLabel">
              Active Students
            </div>
          </div>
        </div>

        <div className="statCard">
          <div
            className="statIcon"
            style={{
              background:
                "#fef2f2",
              color:
                "#dc2626",
            }}
          >
            <Trash2
              size={20}
            />
          </div>

          <div>
            <div className="statValue">
              {inactiveCount}
            </div>

            <div className="statLabel">
              Inactive Students
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================
          FILTERS
      ======================================================= */}

      <section className="filterCard">
        <div className="searchBox">
          <Search
            size={17}
          />

          <input
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Search by name, admission no., chest no., class, house..."
          />

          {search && (
            <button
              type="button"
              className="clearSearch"
              onClick={() =>
                setSearch("")
              }
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <select
          className="filterSelect"
          value={category}
          onChange={(event) =>
            setCategory(
              event.target
                .value as
                | "All"
                | Category
            )
          }
        >
          <option value="All">
            All Categories
          </option>

          {categories.map(
            (item) => (
              <option
                key={item}
                value={item}
              >
                {item}
              </option>
            )
          )}
        </select>

        <select
          className="filterSelect"
          value={house}
          onChange={(event) =>
            setHouse(
              event.target
                .value as
                | "All"
                | House
            )
          }
        >
          <option value="All">
            All Houses
          </option>

          {houses.map(
            (item) => (
              <option
                key={item}
                value={item}
              >
                {item}
              </option>
            )
          )}
        </select>

        <select
          className="filterSelect"
          value={status}
          onChange={(event) =>
            setStatus(
              event.target
                .value as
                | "All"
                | "Active"
                | "Inactive"
            )
          }
        >
          <option value="Active">
            Active Students
          </option>

          <option value="Inactive">
            Inactive Students
          </option>

          <option value="All">
            All Students
          </option>
        </select>

        <button
          className="secondaryButton"
          onClick={() => {
            void loadStudents();
          }}
          disabled={Boolean(loading)}
        >
          <RefreshCw
            size={16}
            className={
              loading
                ? "spin"
                : ""
            }
          />

          Refresh
        </button>
      </section>

      {/* ======================================================
          TABLE
      ======================================================= */}

      <section className="tableCard">
        <div className="tableCardHeader">
          <div>
            <div className="eyebrow">
              STUDENT REGISTER
            </div>

            <h2>
              {filtered.length}{" "}
              student
              {filtered.length ===
              1
                ? ""
                : "s"}
            </h2>
          </div>

          <div className="tableHeaderMeta">
            {search ||
            category !==
              "All" ||
            house !==
              "All" ||
            status !==
              "Active"
              ? "Filtered view"
              : "Active register"}
          </div>
        </div>

        {loading ? (
          <div className="emptyState">
            <RefreshCw
              size={22}
              className="spin"
            />

            <strong>
              Loading students…
            </strong>

            <span>
              Fetching the current
              student register.
            </span>
          </div>
        ) : filtered.length ===
          0 ? (
          <div className="emptyState">
            <Users
              size={28}
            />

            <strong>
              No students found
            </strong>

            <span>
              Try changing your
              search or filters.
            </span>
          </div>
        ) : (
          <div className="tableWrap">
            <table className="adminTable">
              <thead>
                <tr>
                  <th>
                    Chest
                  </th>

                  <th>
                    Admission No.
                  </th>

                  <th>
                    Student
                  </th>

                  <th>
                    Class
                  </th>

                  <th>
                    Category
                  </th>

                  <th>
                    House
                  </th>

                  <th>
                    Status
                  </th>

                  <th>
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filtered.map(
                  (student) => (
                    <tr
                      key={
                        student.id
                      }
                    >
                      <td>
                        <span className="chestBadge">
                          {
                            student.chestNo
                          }
                        </span>
                      </td>

                      <td>
                        <span className="monoValue">
                          {
                            student.admissionNo
                          }
                        </span>
                      </td>

                      <td>
                        <div className="studentName">
                          {
                            student.name
                          }
                        </div>

                        <div className="studentSub">
                          {student.gender ||
                            "Gender not specified"}
                        </div>
                      </td>

                      <td>
                        <strong>
                          {
                            student.className
                          }
                        </strong>

                        {student.division && (
                          <span className="divisionValue">
                            {" "}
                            {
                              student.division
                            }
                          </span>
                        )}
                      </td>

                      <td>
                        <span className="categoryBadge">
                          {
                            student.category
                          }
                        </span>
                      </td>

                      <td>
                        {student.house ? (
                          <span
                            className={houseClass(
                              student.house
                            )}
                          >
                            {
                              student.house
                            }
                          </span>
                        ) : (
                          <span className="mutedValue">
                            Unassigned
                          </span>
                        )}
                      </td>

                      <td>
                        {student.isActive ? (
                          <span className="statusBadge statusActive">
                            <span />
                            Active
                          </span>
                        ) : (
                          <span className="statusBadge statusInactive">
                            <span />
                            Inactive
                          </span>
                        )}
                      </td>

                      <td>
                        <div className="actionButtons">
                          <button
                            className="tableActionButton"
                            onClick={() =>
                              openEditForm(
                                student
                              )
                            }
                            title="Edit student"
                          >
                            <Edit3
                              size={15}
                            />
                            Edit
                          </button>

                          <button
                            className={
                              student.isActive
                                ? "tableActionButton danger"
                                : "tableActionButton success"
                            }
                            onClick={() =>
                              setActionStudent(
                                student
                              )
                            }
                            title={
                              student.isActive
                                ? "Remove student"
                                : "Restore student"
                            }
                          >
                            {student.isActive ? (
                              <>
                                <Trash2
                                  size={15}
                                />
                                Remove
                              </>
                            ) : (
                              <>
                                <RotateCcw
                                  size={15}
                                />
                                Restore
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ======================================================
          EDIT STUDENT MODAL
      ======================================================= */}

      {formOpen &&
        editingStudent && (
          <div className="modalBackdrop">
            <div className="modal">
              <div className="modalHeader">
                <div>
                  <div className="eyebrow">
                    STUDENT EDITOR
                  </div>

                  <h2>
                    Edit Student
                  </h2>

                  <p>
                    Update the student's
                    SARGAMIYA registration
                    information.
                  </p>
                </div>

                <button
                  className="iconButton"
                  onClick={() => {
                    setFormOpen(
                      false
                    );
                    setEditingStudent(
                      null
                    );
                  }}
                  aria-label="Close"
                >
                  <X />
                </button>
              </div>

              {formError && (
                <div className="errorBox">
                  <AlertTriangle
                    size={17}
                  />

                  <span>
                    {formError}
                  </span>
                </div>
              )}

              <div className="formGrid">
                <FormField
                  label="Chest Number"
                  required
                >
                  <input
                    className="formInput"
                    type="number"
                    min="1"
                    value={
                      form.chestNo
                    }
                    onChange={(event) =>
                      updateForm(
                        "chestNo",
                        event.target
                          .value
                      )
                    }
                  />
                </FormField>

                <FormField
                  label="Student Name"
                  required
                  full
                >
                  <input
                    className="formInput"
                    value={
                      form.name
                    }
                    onChange={(event) =>
                      updateForm(
                        "name",
                        event.target
                          .value
                      )
                    }
                  />
                </FormField>

                <FormField
                  label="Class"
                  required
                >
                  <input
                    className="formInput"
                    value={
                      form.className
                    }
                    onChange={(event) =>
                      updateForm(
                        "className",
                        event.target
                          .value
                      )
                    }
                    placeholder="e.g. VIII"
                  />
                </FormField>

                <FormField
                  label="Division"
                >
                  <input
                    className="formInput"
                    value={
                      form.division
                    }
                    onChange={(event) =>
                      updateForm(
                        "division",
                        event.target
                          .value
                      )
                    }
                    placeholder="e.g. C"
                  />
                </FormField>

                <FormField
                  label="Category"
                  required
                >
                  <select
                    className="formInput"
                    value={
                      form.category
                    }
                    onChange={(event) =>
                      updateForm(
                        "category",
                        event.target
                          .value
                      )
                    }
                  >
                    <option value="">
                      Select category
                    </option>

                    {categories.map(
                      (item) => (
                        <option
                          key={item}
                          value={
                            item
                          }
                        >
                          {item}
                        </option>
                      )
                    )}
                  </select>
                </FormField>

                <FormField
                  label="Gender"
                >
                  <input
                    className="formInput"
                    value={
                      form.gender
                    }
                    onChange={(event) =>
                      updateForm(
                        "gender",
                        event.target
                          .value
                      )
                    }
                    placeholder="Male / Female"
                  />
                </FormField>

                <FormField
                  label="House"
                >
                  <select
                    className="formInput"
                    value={
                      form.house
                    }
                    onChange={(event) =>
                      updateForm(
                        "house",
                        event.target
                          .value
                      )
                    }
                  >
                    <option value="">
                      Unassigned
                    </option>

                    {houses.map(
                      (item) => (
                        <option
                          key={item}
                          value={
                            item
                          }
                        >
                          {item}
                        </option>
                      )
                    )}
                  </select>
                </FormField>
              </div>

              <div className="modalFooter">
                <button
                  className="secondaryButton"
                  onClick={() => {
                    setFormOpen(
                      false
                    );
                    setEditingStudent(
                      null
                    );
                  }}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  className="primaryButton"
                  onClick={() => {
                    void saveStudent();
                  }}
                  disabled={saving}
                >
                  {saving
                    ? "Saving…"
                    : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        )}

      {/* ======================================================
          REMOVE / RESTORE MODAL
      ======================================================= */}

      {actionStudent && (
        <div className="modalBackdrop">
          <div
            className="modal"
            style={{
              maxWidth:
                "480px",
            }}
          >
            <div className="modalHeader">
              <div>
                <div className="eyebrow">
                  STUDENT STATUS
                </div>

                <h2>
                  {actionStudent.isActive
                    ? "Remove Student"
                    : "Restore Student"}
                </h2>
              </div>

              <button
                className="iconButton"
                onClick={() =>
                  setActionStudent(
                    null
                  )
                }
                aria-label="Close"
              >
                <X />
              </button>
            </div>

            <div
              style={{
                padding:
                  "20px 0",
              }}
            >
              <p
                style={{
                  margin:
                    "0 0 14px",
                  color:
                    "#334155",
                  lineHeight:
                    1.6,
                }}
              >
                {actionStudent.isActive
                  ? "Are you sure you want to remove this student from the active register?"
                  : "Do you want to restore this student to the active register?"}
              </p>

              <div
                style={{
                  padding:
                    "15px",
                  background:
                    "#f8fafc",
                  border:
                    "1px solid #e2e8f0",
                  borderRadius:
                    "12px",
                }}
              >
                <strong>
                  {
                    actionStudent.name
                  }
                </strong>

                <div
                  style={{
                    marginTop:
                      "5px",
                    color:
                      "#64748b",
                    fontSize:
                      "13px",
                  }}
                >
                  Chest{" "}
                  {
                    actionStudent.chestNo
                  }{" "}
                  · Admission{" "}
                  {
                    actionStudent.admissionNo
                  }
                </div>
              </div>

              {actionStudent.isActive && (
                <div
                  style={{
                    display:
                      "flex",
                    gap:
                      "8px",
                    marginTop:
                      "14px",
                    padding:
                      "12px",
                    borderRadius:
                      "10px",
                    background:
                      "#fff7ed",
                    color:
                      "#9a3412",
                    fontSize:
                      "12px",
                    lineHeight:
                      1.5,
                  }}
                >
                  <AlertTriangle
                    size={16}
                    style={{
                      flexShrink: 0,
                    }}
                  />

                  <span>
                    The student will
                    not be physically
                    deleted. Existing
                    registrations and
                    results remain
                    preserved.
                  </span>
                </div>
              )}
            </div>

            <div className="modalFooter">
              <button
                className="secondaryButton"
                onClick={() =>
                  setActionStudent(
                    null
                  )
                }
                disabled={
                  actionLoading
                }
              >
                Cancel
              </button>

              <button
                className={
                  actionStudent.isActive
                    ? "primaryButton dangerButton"
                    : "primaryButton successButton"
                }
                onClick={() => {
                  void changeStudentStatus();
                }}
                disabled={
                  actionLoading
                }
              >
                {actionLoading
                  ? "Please wait…"
                  : actionStudent.isActive
                  ? "Remove Student"
                  : "Restore Student"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================
          EXCEL IMPORT MODAL
      ======================================================= */}

      {importOpen && (
        <div className="modalBackdrop">
          <div
            className="modal"
            style={{
              maxWidth:
                "920px",
            }}
          >
            <div className="modalHeader">
              <div>
                <div className="eyebrow">
                  BULK IMPORT
                </div>

                <h2>
                  Import Students
                </h2>

                <p>
                  Upload an SARGAMIYA
                  student Excel
                  workbook.
                </p>
              </div>

              <button
                className="iconButton"
                onClick={
                  closeImport
                }
                disabled={
                  importing
                }
                aria-label="Close"
              >
                <X />
              </button>
            </div>

            <div className="uploadBox">
              <Upload
                size={30}
              />

              <strong>
                Select Excel file
              </strong>

              <span>
                Use the SARGAMIYA student
                template for the best
                results.
              </span>

              <label className="uploadButton">
                <Upload
                  size={16}
                />
                Choose .xlsx file

                <input
                  type="file"
                  accept=".xlsx"
                  hidden
                  onChange={(
                    event
                  ) => {
                    const file =
                      event.target
                        .files?.[0];

                    if (file) {
                      void parseFile(
                        file
                      );
                    }

                    event.target.value =
                      "";
                  }}
                />
              </label>
            </div>

            {errors.length >
              0 && (
              <div className="importErrorList">
                <div className="importErrorTitle">
                  <AlertTriangle
                    size={17}
                  />
                  {errors.length} issue
                  {errors.length ===
                  1
                    ? ""
                    : "s"}{" "}
                  found
                </div>

                <div className="importErrors">
                  {errors.map(
                    (
                      item,
                      index
                    ) => (
                      <div
                        key={`${item}-${index}`}
                      >
                        {item}
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {preview.length >
              0 && (
              <div className="previewSection">
                <div className="previewHeader">
                  <div>
                    <strong>
                      Import Preview
                    </strong>

                    <span>
                      {preview.length} valid
                      student record
                      {preview.length ===
                      1
                        ? ""
                        : "s"}
                    </span>
                  </div>

                  <div className="previewCount">
                    Ready
                  </div>
                </div>

                <div className="previewTableWrap">
                  <table className="adminTable">
                    <thead>
                      <tr>
                        <th>
                          Chest
                        </th>
                        <th>
                          Student
                        </th>
                        <th>
                          Class
                        </th>
                        <th>
                          Category
                        </th>
                        <th>
                          House
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {preview
                        .slice(
                          0,
                          12
                        )
                        .map(
                          (
                            student,
                            index
                          ) => (
                            <tr
                              key={`${student.chestNo}-${index}`}
                            >
                              <td>
                                {
                                  student.chestNo
                                }
                              </td>

                              <td>
                                {
                                  student.name
                                }
                              </td>

                              <td>
                                {
                                  student.className
                                }
                                {student.division &&
                                  ` ${student.division}`}
                              </td>

                              <td>
                                {
                                  student.category
                                }
                              </td>

                              <td>
                                {
                                  student.house ||
                                  "Unassigned"
                                }
                              </td>
                            </tr>
                          )
                        )}
                    </tbody>
                  </table>
                </div>

                {preview.length >
                  12 && (
                  <div className="previewMore">
                    Showing the first 12
                    records of{" "}
                    {
                      preview.length
                    }
                    .
                  </div>
                )}
              </div>
            )}

            <div className="modalFooter">
              <button
                className="secondaryButton"
                onClick={
                  closeImport
                }
                disabled={
                  importing
                }
              >
                Cancel
              </button>

              <button
                className="primaryButton"
                onClick={() => {
                  void importStudents();
                }}
                disabled={
                  importing ||
                  preview.length ===
                    0
                }
              >
                {importing
                  ? "Importing…"
                  : `Import ${
                      preview.length
                    } Student${
                      preview.length ===
                      1
                        ? ""
                        : "s"
                    }`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================
          PAGE-SPECIFIC STYLES
      ======================================================= */}

      <style jsx global>{`
        .adminPage {
          min-height: 100vh;
          padding: 34px;
          background: #f8fafc;
          color: #0f172a;
        }

        .pageHeader {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 24px;
        }

        .pageHeader h1 {
          margin: 4px 0 7px;
          color: #0b1f41;
          font-size: 32px;
          line-height: 1.1;
          font-weight: 800;
          letter-spacing: -0.035em;
        }

        .pageHeader p {
          margin: 0;
          max-width: 680px;
          color: #64748b;
          font-size: 14px;
          line-height: 1.6;
        }

        .eyebrow {
          color: #64748b;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .statCard {
          display: flex;
          align-items: center;
          gap: 13px;
          min-height: 88px;
          padding: 17px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          box-shadow:
            0 2px 8px
            rgba(15, 23, 42, 0.035);
        }

        .statIcon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 42px;
          height: 42px;
          flex: 0 0 42px;
          border-radius: 11px;
          background: #eff6ff;
          color: #2563eb;
        }

        .statValue {
          color: #0f172a;
          font-size: 24px;
          font-weight: 800;
          line-height: 1;
        }

        .statLabel {
          margin-top: 5px;
          color: #64748b;
          font-size: 12px;
          font-weight: 600;
        }

        .filterCard {
          display: grid;
          grid-template-columns:
            minmax(280px, 1fr)
            190px
            170px
            170px
            auto;
          align-items: center;
          gap: 10px;
          margin-bottom: 16px;
          padding: 12px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          box-shadow:
            0 2px 8px
            rgba(15, 23, 42, 0.035);
        }

        .searchBox {
          display: flex;
          align-items: center;
          gap: 9px;
          min-width: 0;
          height: 40px;
          padding: 0 12px;
          color: #94a3b8;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 9px;
        }

        .searchBox input {
          width: 100%;
          min-width: 0;
          border: 0;
          outline: 0;
          background: transparent;
          color: #0f172a;
          font: inherit;
          font-size: 13px;
        }

        .searchBox input::placeholder {
          color: #94a3b8;
        }

        .clearSearch {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 25px;
          height: 25px;
          padding: 0;
          border: 0;
          border-radius: 6px;
          background: transparent;
          color: #94a3b8;
          cursor: pointer;
        }

        .clearSearch:hover {
          background: #e2e8f0;
          color: #475569;
        }

        .filterSelect,
        .formInput {
          width: 100%;
          height: 40px;
          padding: 0 11px;
          border: 1px solid #e2e8f0;
          border-radius: 9px;
          outline: none;
          background: white;
          color: #334155;
          font: inherit;
          font-size: 13px;
        }

        .filterSelect:focus,
        .formInput:focus {
          border-color: #60a5fa;
          box-shadow:
            0 0 0 3px
            rgba(59, 130, 246, 0.1);
        }

        .secondaryButton,
        .primaryButton {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          min-height: 38px;
          padding: 0 13px;
          border-radius: 9px;
          font: inherit;
          font-size: 12px;
          font-weight: 700;
          text-decoration: none;
          cursor: pointer;
          transition:
            background 0.15s ease,
            border-color 0.15s ease,
            transform 0.15s ease;
        }

        .secondaryButton {
          border: 1px solid #dbe2ea;
          background: white;
          color: #334155;
        }

        .secondaryButton:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
        }

        .primaryButton {
          border: 1px solid #0b1f41;
          background: #0b1f41;
          color: white;
        }

        .primaryButton:hover {
          background: #122d59;
        }

        .primaryButton:disabled,
        .secondaryButton:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .dangerButton {
          background: #dc2626;
          border-color: #dc2626;
        }

        .dangerButton:hover {
          background: #b91c1c;
        }

        .successButton {
          background: #15803d;
          border-color: #15803d;
        }

        .successButton:hover {
          background: #166534;
        }

        .successBox,
        .errorBox {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          margin-bottom: 16px;
          padding: 12px 14px;
          border-radius: 10px;
          font-size: 13px;
          line-height: 1.5;
        }

        .successBox {
          border: 1px solid #bbf7d0;
          background: #f0fdf4;
          color: #166534;
        }

        .errorBox {
          border: 1px solid #fecaca;
          background: #fef2f2;
          color: #991b1b;
        }

        .tableCard {
          overflow: hidden;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 15px;
          box-shadow:
            0 3px 12px
            rgba(15, 23, 42, 0.035);
        }

        .tableCardHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 19px 20px;
          border-bottom: 1px solid #e2e8f0;
        }

        .tableCardHeader h2 {
          margin: 3px 0 0;
          color: #0f172a;
          font-size: 18px;
          font-weight: 800;
        }

        .tableHeaderMeta {
          padding: 6px 10px;
          border-radius: 999px;
          background: #f1f5f9;
          color: #64748b;
          font-size: 11px;
          font-weight: 700;
        }

        .tableWrap,
        .previewTableWrap {
          width: 100%;
          overflow-x: auto;
        }

        .adminTable {
          width: 100%;
          border-collapse: collapse;
          min-width: 1050px;
        }

        .adminTable th {
          padding: 12px 15px;
          border-bottom: 1px solid #e2e8f0;
          background: #f8fafc;
          color: #64748b;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-align: left;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .adminTable td {
          padding: 13px 15px;
          border-bottom: 1px solid #f1f5f9;
          color: #334155;
          font-size: 12px;
          vertical-align: middle;
        }

        .adminTable tbody tr:hover {
          background: #fafcff;
        }

        .adminTable tbody tr:last-child td {
          border-bottom: 0;
        }

        .chestBadge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 38px;
          height: 28px;
          padding: 0 8px;
          border-radius: 7px;
          background: #eff6ff;
          color: #1d4ed8;
          font-weight: 800;
        }

        .monoValue {
          color: #475569;
          font-family:
            ui-monospace,
            SFMono-Regular,
            Menlo,
            Monaco,
            Consolas,
            monospace;
          font-size: 11px;
        }

        .studentName {
          color: #0f172a;
          font-weight: 750;
        }

        .studentSub {
          margin-top: 3px;
          color: #94a3b8;
          font-size: 10px;
        }

        .divisionValue {
          color: #64748b;
          font-weight: 600;
        }

        .categoryBadge {
          display: inline-flex;
          padding: 5px 8px;
          border-radius: 7px;
          background: #f1f5f9;
          color: #475569;
          font-size: 10px;
          font-weight: 700;
          white-space: nowrap;
        }

        .houseBadge {
          display: inline-flex;
          align-items: center;
          padding: 5px 9px;
          border-radius: 7px;
          font-size: 10px;
          font-weight: 800;
          white-space: nowrap;
        }

        .houseAtlas {
          background: #eff6ff;
          color: #2563eb;
        }

        .houseTitan {
          background: #fef2f2;
          color: #dc2626;
        }

        .houseOlympus {
          background: #f8fafc;
          color: #475569;
          border: 1px solid #e2e8f0;
        }

        .mutedValue {
          color: #94a3b8;
          font-size: 11px;
        }

        .statusBadge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 8px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 800;
        }

        .statusBadge > span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }

        .statusActive {
          background: #ecfdf5;
          color: #15803d;
        }

        .statusActive > span {
          background: #22c55e;
        }

        .statusInactive {
          background: #f8fafc;
          color: #64748b;
        }

        .statusInactive > span {
          background: #94a3b8;
        }

        .actionButtons {
          display: flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
        }

        .tableActionButton {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          height: 30px;
          padding: 0 9px;
          border: 1px solid #e2e8f0;
          border-radius: 7px;
          background: white;
          color: #475569;
          font: inherit;
          font-size: 10px;
          font-weight: 750;
          cursor: pointer;
        }

        .tableActionButton:hover {
          background: #f8fafc;
        }

        .tableActionButton.danger {
          color: #dc2626;
          border-color: #fecaca;
        }

        .tableActionButton.danger:hover {
          background: #fef2f2;
        }

        .tableActionButton.success {
          color: #15803d;
          border-color: #bbf7d0;
        }

        .tableActionButton.success:hover {
          background: #f0fdf4;
        }

        .emptyState {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 7px;
          min-height: 280px;
          padding: 40px;
          color: #94a3b8;
          text-align: center;
        }

        .emptyState strong {
          color: #334155;
          font-size: 14px;
        }

        .emptyState span {
          color: #94a3b8;
          font-size: 12px;
        }

        .modalBackdrop {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background:
            rgba(15, 23, 42, 0.48);
          backdrop-filter: blur(4px);
        }

        .modal {
          width: min(760px, 100%);
          max-height: calc(100vh - 48px);
          overflow-y: auto;
          padding: 22px;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          background: white;
          box-shadow:
            0 25px 70px
            rgba(15, 23, 42, 0.22);
        }

        .modalHeader {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
          padding-bottom: 18px;
          border-bottom: 1px solid #e2e8f0;
        }

        .modalHeader h2 {
          margin: 4px 0 4px;
          color: #0b1f41;
          font-size: 22px;
          font-weight: 800;
          letter-spacing: -0.025em;
        }

        .modalHeader p {
          margin: 0;
          color: #64748b;
          font-size: 12px;
        }

        .iconButton {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          padding: 0;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: white;
          color: #64748b;
          cursor: pointer;
        }

        .iconButton:hover {
          background: #f8fafc;
          color: #334155;
        }

        .formGrid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 15px;
          padding-top: 20px;
        }

        .formField {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .formField.full {
          grid-column: 1 / -1;
        }

        .formLabel {
          color: #334155;
          font-size: 11px;
          font-weight: 750;
        }

        .requiredMark {
          color: #dc2626;
        }

        .modalFooter {
          display: flex;
          justify-content: flex-end;
          gap: 9px;
          margin-top: 22px;
          padding-top: 17px;
          border-top: 1px solid #e2e8f0;
        }

        .uploadBox {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 9px;
          margin-top: 20px;
          padding: 30px;
          border: 1px dashed #bfdbfe;
          border-radius: 13px;
          background: #f8fbff;
          color: #64748b;
          text-align: center;
        }

        .uploadBox strong {
          color: #334155;
          font-size: 14px;
        }

        .uploadBox span {
          font-size: 12px;
        }

        .uploadButton {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          margin-top: 5px;
          padding: 9px 13px;
          border-radius: 8px;
          background: #0b1f41;
          color: white;
          font-size: 12px;
          font-weight: 750;
          cursor: pointer;
        }

        .importErrorList {
          margin-top: 15px;
          padding: 13px;
          border: 1px solid #fecaca;
          border-radius: 10px;
          background: #fff7f7;
        }

        .importErrorTitle {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #991b1b;
          font-size: 12px;
          font-weight: 800;
        }

        .importErrors {
          display: flex;
          flex-direction: column;
          gap: 4px;
          max-height: 140px;
          overflow-y: auto;
          margin-top: 8px;
          color: #b91c1c;
          font-size: 11px;
        }

        .previewSection {
          margin-top: 18px;
          border: 1px solid #e2e8f0;
          border-radius: 11px;
          overflow: hidden;
        }

        .previewHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          border-bottom: 1px solid #e2e8f0;
          background: #f8fafc;
        }

        .previewHeader > div:first-child {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .previewHeader strong {
          color: #334155;
          font-size: 12px;
        }

        .previewHeader span {
          color: #94a3b8;
          font-size: 10px;
        }

        .previewCount {
          padding: 5px 8px;
          border-radius: 999px;
          background: #ecfdf5;
          color: #15803d;
          font-size: 10px;
          font-weight: 800;
        }

        .previewMore {
          padding: 9px 14px;
          border-top: 1px solid #e2e8f0;
          color: #64748b;
          font-size: 10px;
        }

        .spin {
          animation: adminSpin 0.9s linear infinite;
        }

        @keyframes adminSpin {
          from {
            transform: rotate(0deg);
          }

          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1100px) {
          .filterCard {
            grid-template-columns:
              1fr 1fr;
          }

          .searchBox {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 800px) {
          .adminPage {
            padding: 20px;
          }

          .pageHeader {
            flex-direction: column;
          }

          .pageHeader > div:last-child {
            width: 100%;
            justify-content: flex-start !important;
          }

          .statCard {
            min-width: 0;
          }

          .formGrid {
            grid-template-columns: 1fr;
          }

          .formField.full {
            grid-column: auto;
          }
        }

        @media (max-width: 600px) {
          .adminPage {
            padding: 15px;
          }

          .pageHeader h1 {
            font-size: 27px;
          }

          .filterCard {
            grid-template-columns: 1fr;
          }

          .searchBox {
            grid-column: auto;
          }

          .filterCard > button {
            width: 100%;
          }

          .statCard {
            min-height: 75px;
          }

          .statValue {
            font-size: 20px;
          }

          .modalBackdrop {
            padding: 10px;
          }

          .modal {
            max-height: calc(100vh - 20px);
            padding: 17px;
          }
        }
      `}</style>
    </main>
  );
}

/* ============================================================
   FORM FIELD
============================================================ */

function FormField({
  label,
  required = false,
  full = false,
  children,
}: {
  label: string;
  required?: boolean;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        full
          ? "formField full"
          : "formField"
      }
    >
      <label className="formLabel">
        {label}

        {required && (
          <span className="requiredMark">
            {" "}
            *
          </span>
        )}
      </label>

      {children}
    </div>
  );
}