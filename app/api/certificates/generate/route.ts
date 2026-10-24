import { NextRequest, NextResponse } from "next/server";

import React from "react";

import { renderToBuffer } from "@react-pdf/renderer";

import QRCode from "qrcode";

import fs from "node:fs/promises";

import path from "node:path";

import { createServerSupabaseClient } from "@/lib/supabase/server";

import {

  CertificateDocument,

  type CertificateData,

} from "@/components/certificates/CertificateDocument";

export const runtime = "nodejs";

/* ============================================================

   HELPERS

============================================================ */

async function dataUri(fileName: string): Promise<string> {

  const filePath = path.join(

    process.cwd(),

    "public",

    "certificates",

    fileName

  );

  const extension = path.extname(fileName).toLowerCase();

  let mimeType = "image/png";

  if (extension === ".jpg" || extension === ".jpeg") {

    mimeType = "image/jpeg";

  } else if (extension === ".webp") {

    mimeType = "image/webp";

  }

  const file = await fs.readFile(filePath);

  return `data:${mimeType};base64,${file.toString("base64")}`;

}

function achievementLabel(position: number): string {

  switch (position) {

    case 1:

      return "CHAMPION";

    case 2:

      return "RUNNER-UP";

    case 3:

      return "THIRD PLACE";

    default:

      return "ACHIEVEMENT";

  }

}

function formatCertificateDate(

  value: string | null | undefined

): string {

  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) {

    return new Date().toLocaleDateString("en-IN", {

      day: "2-digit",

      month: "long",

      year: "numeric",

      timeZone: "Asia/Kolkata",

    });

  }

  return date.toLocaleDateString("en-IN", {

    day: "2-digit",

    month: "long",

    year: "numeric",

    timeZone: "Asia/Kolkata",

  });

}

function safeFileName(value: string): string {

  const cleaned = value

    .normalize("NFKD")

    .replace(/[^\w\s-]/g, "")

    .trim()

    .replace(/\s+/g, "-")

    .replace(/-+/g, "-");

  return cleaned || "participant";

}

/* ============================================================

   CERTIFICATE DATA

============================================================ */

async function buildCertificate(

  supabase: Awaited<

    ReturnType<typeof createServerSupabaseClient>

  >,

  certificateNo: string

) {

  /*

   * The verification view contains the public certificate

   * information needed to render the PDF.

   *

   * It deliberately avoids exposing internal student data.

   */

  const { data: certificate, error } = await supabase

    .from("athlon_certificate_verification")

    .select("*")

    .eq("certificate_no", certificateNo)

    .single();

  if (error) {

    console.error(

      "CERTIFICATE VERIFICATION LOOKUP ERROR:",

      error

    );

    throw new Error(

      error.message ||

        "Unable to find the certificate verification record."

    );

  }

  if (!certificate) {

    throw new Error(

      "Certificate verification record not found."

    );

  }

  /*

   * Do not generate PDFs for revoked certificates.

   */

  if (certificate.revoked_at) {

    throw new Error(

      "This certificate has been revoked and cannot be generated."

    );

  }

  const siteUrl =

    process.env.NEXT_PUBLIC_SITE_URL ||

    "http://localhost:3000";

  const verificationUrl =

    `${siteUrl.replace(/\/$/, "")}/verify/` +

    encodeURIComponent(certificateNo);

  /*

   * Generate the QR dynamically.

   */

  const qrDataUrl = await QRCode.toDataURL(

    verificationUrl,

    {

      width: 220,

      margin: 1,

      errorCorrectionLevel: "M",

    }

  );

  /*

   * Load official certificate assets.

   */

  const [

    esraLogo,

    sargamiyaLogo,

    artsFestCoordinatorSignature,

    principalSignature,

  ] = await Promise.all([

    dataUri("esra-logo.png"),

    dataUri("sargamiya-logo-placeholder.png"),

    dataUri("arts-fest-coordinator-signature-placeholder.png"),

    dataUri("principal-signature.png"),

  ]);

  const position = Number(

    certificate.position ?? 0

  );

  const data: CertificateData = {

    certificateNo,

    participantName:

      certificate.participant_name ||

      "Participant",

    eventName:

      certificate.event_name ||

      "SARGAMIYA Event",

    category:

      certificate.category ||

      "—",

    houseName:

      certificate.house ||

      null,

    achievement:

      certificate.achievement ||

      achievementLabel(position),

    position,

    resultValue:

      certificate.result_value ??

      null,

    resultUnit:

      certificate.result_unit ??

      null,

    date: formatCertificateDate(

      certificate.generated_at

    ),

    verificationUrl,

    qrDataUrl,

    esraLogo,

    sargamiyaLogo,

    artsFestCoordinatorSignature,

    principalSignature,

  };

  /*

   * @react-pdf/renderer expects a ReactElement<DocumentProps>.

   *

   * CertificateDocument has its own CertificateData props,

   * so we create the React element normally and cast it to

   * the renderer's accepted element type.

   *

   * This avoids JSX inside a .ts Route Handler.

   */

  const documentElement =

    React.createElement(

      CertificateDocument,

      { data }

    ) as Parameters<typeof renderToBuffer>[0];

  const buffer =

    await renderToBuffer(documentElement);

  return {

    data,

    buffer,

  };

}

/* ============================================================

   POST

============================================================ */

export async function POST(

  request: NextRequest

) {

  try {

    /*

     * Use the application's existing server-side

     * Supabase client.

     *

     * This uses:

     * NEXT_PUBLIC_SUPABASE_URL

     * NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

     */

    const supabase =

      await createServerSupabaseClient();

    /* ============================================================

       AUTHENTICATION

    ============================================================ */
    const {

      data: { user },

      error: authError,

    } = await supabase.auth.getUser();

    if (authError) {

      console.error(

        "CERTIFICATE AUTH ERROR:",

        authError

      );

      return NextResponse.json(

        {

          error:

            "Unable to verify your authentication session.",

        },

        { status: 401 }

      );

    }

    if (!user) {

      return NextResponse.json(

        {

          error:

            "Authentication required to generate certificates.",

        },

        { status: 401 }

      );

    }

    /* ============================================================

       REQUEST BODY

    ============================================================ */

    let body: unknown;

    try {

      body = await request.json();

    } catch {

      return NextResponse.json(

        {

          error:

            "Invalid request body. Expected JSON.",

        },

        { status: 400 }

      );

    }

    if (

      typeof body !== "object" ||

      body === null

    ) {

      return NextResponse.json(

        {

          error:

            "Invalid request body.",

        },

        { status: 400 }

      );

    }

    const requestBody =

      body as Record<string, unknown>;

    const resultId =

      typeof requestBody.resultId === "string"

        ? requestBody.resultId.trim()

        : "";

    const studentId =

      typeof requestBody.studentId === "string"

        ? requestBody.studentId.trim()

        : "";

    const requestedCertificateNo =

      typeof requestBody.certificateNo === "string"

        ? requestBody.certificateNo.trim()

        : "";

    /* ============================================================

       CERTIFICATE NUMBER

    ============================================================ */

    let certificateNo =

      requestedCertificateNo;

    /*

     * If a certificate number was not supplied, create the

     * certificate from a result/student pair.

     *

     * This is used by the Admin Certificates page for

     * individual results.

     */

    if (!certificateNo) {

      if (!resultId) {

        return NextResponse.json(

          {

            error:

              "resultId is required.",

          },

          { status: 400 }

        );

      }

      /*
       * The Admin Certificates page sends only resultId.
       * Resolve the student_id from the selected result itself.
       */
      const {
        data: result,
        error: resultError,
      } = await supabase
        .from("results")
        .select(
          "id, student_id, team_id, position, status"
        )
        .eq("id", resultId)
        .single();

      if (resultError || !result) {
        console.error(
          "CERTIFICATE RESULT LOOKUP ERROR:",
          resultError
        );

        return NextResponse.json(
          {
            error: "Result not found.",
            detail:
              resultError?.message ||
              "Unable to find the selected result.",
          },
          { status: 404 }
        );
      }

      if (result.status !== "official") {
        return NextResponse.json(
          {
            error:
              "Certificates can only be generated for official results.",
          },
          { status: 400 }
        );
      }

      if (
        result.position !== 1 &&
        result.position !== 2 &&
        result.position !== 3
      ) {
        return NextResponse.json(
          {
            error:
              "Certificates can only be generated for 1st, 2nd, or 3rd place.",
          },
          { status: 400 }
        );
      }

      /*
       * results.student_id is the authoritative student reference
       * for an individual result.
       */
      const resolvedStudentId =
        typeof result.student_id === "string"
          ? result.student_id
          : "";

      if (!resolvedStudentId) {
        return NextResponse.json(
          {
            error:
              "This result is not an individual result with an associated student.",
          },
          { status: 400 }
        );
      }

      /*
       * If the client supplied studentId, verify that it matches
       * the student attached to the selected result.
       */
      if (
        studentId &&
        studentId !== resolvedStudentId
      ) {
        return NextResponse.json(
          {
            error:
              "The supplied student does not match the selected result.",
          },
          { status: 400 }
        );
      }

      const {
        data: certificateResult,
        error: certificateError,
      } = await supabase.rpc(
        "create_athlon_certificate",
        {
          p_result_id: resultId,
          p_student_id: resolvedStudentId,
        }
      );
      if (certificateError) {

        console.error(

          "CERTIFICATE CREATION RPC ERROR:",

          certificateError

        );

        return NextResponse.json(

          {

            error:

              certificateError.message ||

              "Unable to create certificate.",

          },

          { status: 400 }

        );

      }

      /*

       * Depending on the Supabase function return type,

       * the RPC can return either the certificate number

       * directly or an object containing certificate_no.

       */

      if (

        typeof certificateResult ===

        "string"

      ) {

        certificateNo =

          certificateResult;

      } else if (

        certificateResult &&

        typeof certificateResult ===

          "object" &&

        "certificate_no" in

          certificateResult

      ) {

        const returned =

          (

            certificateResult as {

              certificate_no?: unknown;

            }

          ).certificate_no;

        if (

          typeof returned ===

          "string"

        ) {

          certificateNo =

            returned;

        }

      }

      if (!certificateNo) {

        console.error(

          "CERTIFICATE RPC RETURNED:",

          certificateResult

        );

        return NextResponse.json(

          {

            error:

              "Certificate was created, but no certificate number was returned.",

          },

          { status: 500 }

        );

      }

    }

    /* ============================================================

       BUILD PDF

    ============================================================ */

    const {

      data,

      buffer,

    } = await buildCertificate(

      supabase,

      certificateNo

    );

    /* --------------------------------------------------------

       RESPONSE FILE NAME

    ============================================================ */

    const participant =

      safeFileName(

        data.participantName

      );

    const filename =

      `${certificateNo}-${participant}.pdf`;

    /* ============================================================

       PDF RESPONSE

    ============================================================ */

    return new NextResponse(

      new Uint8Array(buffer),

      {

        status: 200,

        headers: {

          "Content-Type":

            "application/pdf",

          "Content-Disposition":

            `attachment; filename="${filename}"`,

          "Cache-Control":

            "no-store, no-cache, must-revalidate",

          Pragma: "no-cache",

        },

      }

    );

  } catch (error) {

    console.error(

      "CERTIFICATE GENERATION FAILED:",

      error

    );

    const message =

      error instanceof Error

        ? error.message

        : "Certificate generation failed.";

    return NextResponse.json(

      {

        error: message,

      },

      { status: 500 }

    );

  }

}
