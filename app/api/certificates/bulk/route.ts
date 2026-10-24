import { NextRequest, NextResponse } from "next/server";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import JSZip from "jszip";
import fs from "node:fs/promises";
import path from "node:path";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  CertificateDocument,
  type CertificateData,
} from "@/components/certificates/CertificateDocument";

export const runtime = "nodejs";

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

function safeFileName(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-") || "participant"
  );
}

function formatDate(value: string | null | undefined): string {
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

type CertificateAssets = {
  esraLogo: string;
  sargamiyaLogo: string;
  artsFestCoordinatorSignature: string;
  principalSignature: string;
};

type ResultRow = {
  id: string;
  event_id: string | null;
  student_id: string | null;
  team_id: string | null;
  position: number | null;
  result_value: string | number | null;
  result_unit: string | null;
  entered_at: string | null;
  status: string | null;
};

type TeamMember = {
  student_id: string;
  member_order: number | null;
};

async function renderCertificate(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  certificateNo: string,
  assets: CertificateAssets
) {
  const { data: certificate, error } = await supabase
    .from("athlon_certificate_verification")
    .select("*")
    .eq("certificate_no", certificateNo)
    .single();

  if (error) {
    throw new Error(
      `Unable to load ${certificateNo}: ${error.message}`
    );
  }

  if (!certificate) {
    throw new Error(
      `Certificate ${certificateNo} was not found.`
    );
  }

  if (certificate.revoked_at) {
    throw new Error(
      `Certificate ${certificateNo} has been revoked.`
    );
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";

  const verificationUrl =
    `${siteUrl.replace(/\/$/, "")}/verify/` +
    encodeURIComponent(certificateNo);

  const qrDataUrl = await QRCode.toDataURL(
    verificationUrl,
    {
      width: 220,
      margin: 1,
      errorCorrectionLevel: "M",
    }
  );

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

    date: formatDate(
      certificate.generated_at
    ),

    verificationUrl,

    qrDataUrl,

    esraLogo:
      assets.esraLogo,

    sargamiyaLogo:
      assets.sargamiyaLogo,

    artsFestCoordinatorSignature:
      assets.artsFestCoordinatorSignature,

    principalSignature:
      assets.principalSignature,
  };

  const documentElement = React.createElement(
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

export async function POST(
  request: NextRequest
) {
  try {
    const supabase =
      await createServerSupabaseClient();

    /* -------------------------------------------------------
       AUTHENTICATION
    ------------------------------------------------------- */

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error(
        "CERTIFICATE BULK AUTH ERROR:",
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

    /* -------------------------------------------------------
       REQUEST BODY
    ------------------------------------------------------- */

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

    const resultIds =
      Array.isArray(
        requestBody.resultIds
      )
        ? requestBody.resultIds.filter(
            (
              value
            ): value is string =>
              typeof value === "string" &&
              value.trim().length > 0
          )
        : [];

    const certificateNumbers =
      Array.isArray(
        requestBody.certificateNos
      )
        ? requestBody.certificateNos.filter(
            (
              value
            ): value is string =>
              typeof value === "string" &&
              value.trim().length > 0
          )
        : [];

    if (
      resultIds.length === 0 &&
      certificateNumbers.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Select at least one result or certificate.",
        },
        { status: 400 }
      );
    }

    const uniqueResultIds = [
      ...new Set(resultIds),
    ];

    const uniqueCertificateNumbers = [
      ...new Set(certificateNumbers),
    ];

    if (
      uniqueResultIds.length > 100 ||
      uniqueCertificateNumbers.length > 100
    ) {
      return NextResponse.json(
        {
          error:
            "A maximum of 100 selections can be processed at once.",
        },
        { status: 400 }
      );
    }

    /* -------------------------------------------------------
       LOAD CERTIFICATE ASSETS
    ------------------------------------------------------- */

    const [
      esraLogo,
      sargamiyaLogo,
      artsFestCoordinatorSignature,
      principalSignature,
    ] = await Promise.all([
      dataUri("esra-logo.png"),
      dataUri("sargamiya-logo-placeholder.png"),
      dataUri(
        "arts-fest-coordinator-signature-placeholder.png"
      ),
      dataUri(
        "principal-signature.png"
      ),
    ]);

    const assets: CertificateAssets = {
      esraLogo,
      sargamiyaLogo,
      artsFestCoordinatorSignature,
      principalSignature,
    };

    /* -------------------------------------------------------
       ZIP + TRACKING
    ------------------------------------------------------- */

    const zip = new JSZip();

    const generated: Array<{
      certificateNo: string;
      resultId: string;
      participantName: string;
    }> = [];

    const failed: Array<{
      resultId: string;
      certificateNo?: string;
      participantName?: string;
      error: string;
    }> = [];

    /* =======================================================
       PROCESS SELECTED RESULTS
    ======================================================= */

    for (
      const resultId of uniqueResultIds
    ) {
      try {
        const {
          data: result,
          error: resultError,
        } = await supabase
          .from("results")
          .select(
            "id,event_id,student_id,team_id,position,result_value,result_unit,entered_at,status"
          )
          .eq("id", resultId)
          .single();

        if (
          resultError ||
          !result
        ) {
          throw new Error(
            resultError?.message ||
              "Result was not found."
          );
        }

        const typedResult =
          result as ResultRow;

        /*
         * IMPORTANT:
         * Normalize the result ID to string here.
         * This fixes the TypeScript unknown/string issue.
         */
        const currentResultId =
          String(
            typedResult.id ??
              resultId
          );

        const position =
          Number(
            typedResult.position
          );

        if (
          typedResult.status !==
          "official"
        ) {
          throw new Error(
            "Result is not official."
          );
        }

        if (
          ![1, 2, 3].includes(
            position
          )
        ) {
          throw new Error(
            "Only 1st, 2nd and 3rd place results are eligible."
          );
        }

        /* ---------------------------------------------------
           FIND PARTICIPANTS
        --------------------------------------------------- */

        const studentIds: string[] =
          [];

        if (
          typedResult.student_id
        ) {
          studentIds.push(
            typedResult.student_id
          );
        }

        if (
          typedResult.team_id
        ) {
          const {
            data: members,
            error:
              membersError,
          } = await supabase
            .from(
              "event_team_members"
            )
            .select(
              "student_id,member_order"
            )
            .eq(
              "team_id",
              typedResult.team_id
            )
            .order(
              "member_order",
              {
                ascending:
                  true,
              }
            );

          if (
            membersError
          ) {
            throw new Error(
              `Unable to load team members: ${membersError.message}`
            );
          }

          studentIds.push(
            ...(
              (members ??
                []) as TeamMember[]
            )
              .map(
                (member) =>
                  member.student_id
              )
              .filter(Boolean)
          );
        }

        const uniqueStudentIds =
          [
            ...new Set(
              studentIds
            ),
          ];

        /*
         * IMPORTANT:
         * currentResultId is deliberately declared BEFORE
         * the participant loop so it is available to all
         * certificate generation/failure paths.
         */

        for (
          const studentId of uniqueStudentIds
        ) {
          let participantName =
            "Participant";

          let certificateNo:
            | string
            | undefined;

          try {
            /* -----------------------------------------------
               LOAD STUDENT
            ----------------------------------------------- */

            const {
              data: student,
              error:
                studentError,
            } = await supabase
              .from("students")
              .select("name")
              .eq(
                "id",
                studentId
              )
              .single();

            if (
              studentError ||
              !student
            ) {
              throw new Error(
                studentError?.message ||
                  "Participant was not found."
              );
            }

            participantName =
              String(
                student.name ||
                  "Participant"
              );

            /* -----------------------------------------------
               CREATE CERTIFICATE
            ----------------------------------------------- */

            const {
              data:
                certificateResult,
              error:
                certificateError,
            } =
              await supabase.rpc(
                "create_athlon_certificate",
                {
                  p_result_id:
                    currentResultId,

                  p_student_id:
                    studentId,
                }
              );

            if (
              certificateError
            ) {
              throw new Error(
                certificateError.message ||
                  "Unable to create certificate."
              );
            }

            /* -----------------------------------------------
               RESOLVE CERTIFICATE NUMBER
            ----------------------------------------------- */

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
                )
                  .certificate_no;

              if (
                typeof returned ===
                "string"
              ) {
                certificateNo =
                  returned;
              }
            }

            if (
              !certificateNo
            ) {
              throw new Error(
                "Certificate was created, but no certificate number was returned."
              );
            }

            /* -----------------------------------------------
               RENDER PDF
            ----------------------------------------------- */

            const rendered =
              await renderCertificate(
                supabase,
                certificateNo,
                assets
              );

            const renderedName =
              String(
                rendered.data
                  .participantName ||
                  participantName ||
                  "Participant"
              );

            const filename =
              `${certificateNo}-${safeFileName(
                renderedName
              )}.pdf`;

            zip.file(
              filename,
              rendered.buffer
            );

            /* -----------------------------------------------
               SUCCESS
            ----------------------------------------------- */

            generated.push({
              certificateNo,

              resultId:
                currentResultId,

              participantName:
                renderedName,
            });
          } catch (error) {
            const message =
              error instanceof Error
                ? error.message
                : "Certificate generation failed.";

            console.error(
              `BULK CERTIFICATE ERROR [${currentResultId}/${studentId}]`,
              error
            );

            failed.push({
              resultId:
                currentResultId,

              participantName:
                String(
                  participantName
                ),

              certificateNo,

              error:
                message,
            });
          }
        }

        /* ---------------------------------------------------
           RESULT WITHOUT PARTICIPANT
        --------------------------------------------------- */

        if (
          uniqueStudentIds.length ===
          0
        ) {
          failed.push({
            resultId:
              currentResultId,

            error:
              "No participant was found for this result.",
          });
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Certificate generation failed.";

        console.error(
          `BULK CERTIFICATE RESULT ERROR [${resultId}]`,
          error
        );

        failed.push({
          resultId:
            String(resultId),

          error:
            message,
        });
      }
    }

    /* =======================================================
       EXISTING CERTIFICATE NUMBERS
    ======================================================= */

    for (
      const certificateNo of
        uniqueCertificateNumbers
    ) {
      try {
        const rendered =
          await renderCertificate(
            supabase,
            certificateNo,
            assets
          );

        const participantName =
          String(
            rendered.data
              .participantName ||
              "Participant"
          );

        const filename =
          `${certificateNo}-${safeFileName(
            participantName
          )}.pdf`;

        zip.file(
          filename,
          rendered.buffer
        );

        generated.push({
          certificateNo,

          resultId:
            "",

          participantName,
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Certificate generation failed.";

        console.error(
          `BULK CERTIFICATE NUMBER ERROR [${certificateNo}]`,
          error
        );

        failed.push({
          resultId:
            "",

          certificateNo,

          error:
            message,
        });
      }
    }

    /* =======================================================
       NOTHING GENERATED
    ======================================================= */

    if (
      generated.length ===
      0
    ) {
      return NextResponse.json(
        {
          error:
            "None of the selected certificates could be generated.",

          selectedResults:
            uniqueResultIds.length,

          generated:
            0,

          failed:
            failed.length,

          failures:
            failed,
        },
        {
          status: 500,
        }
      );
    }

    /* =======================================================
       GENERATION REPORT
    ======================================================= */

    const reportLines = [
      "SARGAMIYA 2026 — BULK CERTIFICATE GENERATION REPORT",
      "=================================================",
      "",
      `Selected results: ${uniqueResultIds.length}`,
      `Certificates generated: ${generated.length}`,
      `Failures: ${failed.length}`,
      "",
      "GENERATED",
      "---------",

      ...generated.map(
        (item) =>
          `${item.certificateNo} | ${item.participantName} | Result: ${
            item.resultId ||
            "Existing certificate"
          }`
      ),

      "",
      "FAILED",
      "------",

      ...(failed.length
        ? failed.map(
            (item) =>
              `${item.certificateNo || "NO CERTIFICATE"} | ${
                item.participantName ||
                "Unknown participant"
              } | Result: ${
                item.resultId ||
                "—"
              } | ${item.error}`
          )
        : ["None"]),

      "",
    ];

    zip.file(
      "BULK-GENERATION-REPORT.txt",
      reportLines.join("\n")
    );

    /* =======================================================
       GENERATE ZIP
    ======================================================= */

    const zipBuffer =
      await zip.generateAsync({
        type: "uint8array",

        compression:
          "DEFLATE",

        compressionOptions: {
          level: 6,
        },
      });

    const responseBuffer =
      Buffer.from(zipBuffer);

    /* =======================================================
       RESPONSE
    ======================================================= */

    return new NextResponse(
      responseBuffer,
      {
        status: 200,

        headers: {
          "Content-Type":
            "application/zip",

          "Content-Disposition":
            'attachment; filename="SARGAMIYA-2026-Certificates.zip"',

          "Cache-Control":
            "no-store, no-cache, must-revalidate",

          Pragma:
            "no-cache",

          "X-Certificates-Selected":
            String(
              uniqueResultIds.length
            ),

          "X-Certificates-Generated":
            String(
              generated.length
            ),

          "X-Certificates-Failed":
            String(
              failed.length
            ),
        },
      }
    );
  } catch (error) {
    console.error(
      "BULK CERTIFICATE GENERATION FAILED:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Bulk certificate generation failed.";

    return NextResponse.json(
      {
        error:
          message,
      },
      {
        status: 500,
      }
    );
  }
}