import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const { data, error } = await supabase
      .from("athlon_results_detail")
      .select("id,event_id,event_name,event_format,student_id,chest_no,student_name,class_name,division,team_id,team_name,house,position,result_value,result_unit,status,points_awarded,notes,entered_at,updated_at")
      .order("event_name", { ascending: true })
      .order("position", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "SARGAMIYA 2026";
    workbook.created = new Date();
    const sheet = workbook.addWorksheet("Results");

    sheet.columns = [
      { header: "Result ID", key: "id", width: 38 },
      { header: "Event", key: "event_name", width: 30 },
      { header: "Format", key: "event_format", width: 14 },
      { header: "Chest No.", key: "chest_no", width: 12 },
      { header: "Participant / Team", key: "participant", width: 30 },
      { header: "Class", key: "class_name", width: 12 },
      { header: "Division", key: "division", width: 12 },
      { header: "House", key: "house", width: 14 },
      { header: "Position", key: "position", width: 10 },
      { header: "Result", key: "result", width: 16 },
      { header: "Status", key: "status", width: 18 },
      { header: "Points Awarded", key: "points_awarded", width: 16 },
      { header: "Notes", key: "notes", width: 32 },
      { header: "Entered At", key: "entered_at", width: 22 },
      { header: "Updated At", key: "updated_at", width: 22 },
    ];

    for (const row of data ?? []) {
      sheet.addRow({
        id: row.id,
        event_name: row.event_name,
        event_format: row.event_format,
        chest_no: row.chest_no ?? "",
        participant: row.student_name ?? row.team_name ?? "",
        class_name: row.class_name ?? "",
        division: row.division ?? "",
        house: row.house ?? "",
        position: row.position ?? "",
        result: [row.result_value, row.result_unit].filter((v) => v !== null && v !== "").join(" "),
        status: row.status,
        points_awarded: row.points_awarded ?? 0,
        notes: row.notes ?? "",
        entered_at: row.entered_at ?? "",
        updated_at: row.updated_at ?? "",
      });
    }

    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = { from: "A1", to: "O1" };

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="SARGAMIYA-2026-Results.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("RESULT EXPORT FAILED:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to export results." }, { status: 500 });
  }
}
