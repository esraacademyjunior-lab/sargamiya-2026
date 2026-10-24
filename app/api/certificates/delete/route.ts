import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const resultId =
      typeof body?.resultId === "string"
        ? body.resultId.trim()
        : "";

    if (!resultId) {
      return NextResponse.json(
        { error: "Result ID is required." },
        { status: 400 }
      );
    }

    /*
     * Delete/revoke by result ID directly.
     *
     * The Certificates page already has the authoritative result_id.
     * Looking up result_id through the public verification view first can
     * fail when that view does not expose result_id. The RPC now resolves
     * the private certificate storage table server-side instead.
     */
    const { data, error } = await supabase.rpc(
      "delete_athlon_certificates_by_result",
      {
        p_result_id: resultId,
      }
    );

    if (error) {
      console.error(
        "CERTIFICATE DELETE RPC ERROR:",
        error
      );

      return NextResponse.json(
        {
          error:
            error.message ||
            "Unable to delete certificate.",
        },
        { status: 400 }
      );
    }

    if (!data || data.deleted_count === 0) {
      return NextResponse.json(
        {
          error:
            "No active certificate was found for this result.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      resultId,
      deletedCount: data.deleted_count,
    });
  } catch (error) {
    console.error(
      "CERTIFICATE DELETE FAILED:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to delete certificate.",
      },
      { status: 500 }
    );
  }
}
