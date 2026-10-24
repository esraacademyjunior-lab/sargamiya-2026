import { NextRequest, NextResponse } from "next/server";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import fs from "node:fs/promises";
import path from "node:path";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  CertificateDocument,
  type CertificateData,
} from "@/components/certificates/CertificateDocument";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PublicCertificate = {
  certificate_no: string;
  achievement: string | null;
  generated_at: string | null;
  revoked_at: string | null;
  participant_name: string | null;
  event_name: string | null;
  category: string | null;
  discipline: string | null;
  team_name: string | null;
  house: string | null;
  position: number | null;
  result_value: string | null;
  result_unit: string | null;
  chest_no: number | null;
};

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

async function loadCertificate(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  certificateNo: string
): Promise<PublicCertificate> {
  const { data, error } = await supabase
    .from("athlon_public_certificate_lookup")
    .select(
      "certificate_no,achievement,generated_at,revoked_at,participant_name,event_name,category,discipline,team_name,house,position,result_value,result_unit,chest_no"
    )
    .eq("certificate_no", certificateNo)
    .maybeSingle();

  if (error) {
    console.error("PUBLIC CERTIFICATE LOOKUP ERROR:", error);
    throw new Error("Unable to verify the certificate at this time.");
  }

  if (!data) {
    throw new Error(
      "Certificate not found. Please check the certificate number."
    );
  }

  if (data.revoked_at) {
    throw new Error(
      "This certificate has been revoked and cannot be downloaded."
    );
  }

  return data as PublicCertificate;
}

export async function GET(request: NextRequest) {
  try {
    const certificateNo =
      request.nextUrl.searchParams.get("certificateNo")?.trim() || "";

    if (!certificateNo) {
      return NextResponse.json(
        { error: "certificateNo is required." },
        { status: 400 }
      );
    }

    if (!/^SAR26-CERT-\d{5}$/i.test(certificateNo)) {
      return NextResponse.json(
        { error: "Invalid certificate number." },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const certificate = await loadCertificate(supabase, certificateNo);

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

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;

    const verificationUrl =
      `${siteUrl.replace(/\/$/, "")}/verify/` +
      encodeURIComponent(certificate.certificate_no);

    const position = Number(certificate.position ?? 0);

    const data: CertificateData = {
      certificateNo: certificate.certificate_no,
      participantName: certificate.participant_name || "Participant",
      eventName: certificate.event_name || "SARGAMIYA Event",
      category: certificate.category || "—",
      houseName: certificate.house || null,
      achievement:
        certificate.achievement || achievementLabel(position),
      position,
      resultValue: certificate.result_value ?? null,
      resultUnit: certificate.result_unit ?? null,
      date: formatDate(certificate.generated_at),
      verificationUrl,
      qrDataUrl: "",
      esraLogo,
      sargamiyaLogo,
      artsFestCoordinatorSignature,
      principalSignature,
    };

    const documentElement = React.createElement(
      CertificateDocument,
      { data }
    ) as Parameters<typeof renderToBuffer>[0];

    const buffer = await renderToBuffer(documentElement);
    const participant = safeFileName(data.participantName);
    const filename = `${data.certificateNo}-${participant}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("PUBLIC CERTIFICATE DOWNLOAD ERROR:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unable to download the certificate.";

    const status =
      message.includes("not found") || message.includes("revoked")
        ? 404
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
