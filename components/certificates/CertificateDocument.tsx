import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";

export type CertificateData = {
  certificateNo: string;
  participantName: string;
  eventName: string;
  category: string;
  houseName?: string | null;
  achievement: string;
  position: number;
  resultValue?: string | null;
  resultUnit?: string | null;
  date: string;
  verificationUrl: string;
  qrDataUrl: string;
  esraLogo: string;
  sargamiyaLogo: string;
  artsFestCoordinatorSignature: string;
  principalSignature: string;
};

const NAVY = "#0B1F41";
const BLUE = "#167BF1";
const BLUE_DARK = "#123E7D";
const GOLD = "#C99516";
const MUTED = "#52647B";
const PALE = "#F4F8FC";
const WHITE = "#FFFFFF";
const LIGHT_LINE = "#A9B8C9";


const styles = StyleSheet.create({
  /*
   * Keep normal page measurement for this absolute-positioned composition.
   * Do not disable page wrapping on the Page component.
   */
  page: {
    width: "100%",
    height: "100%",
    backgroundColor: WHITE,
    fontFamily: "Helvetica",
    color: NAVY,
    position: "relative",
    overflow: "hidden",
    padding: 0,
    margin: 0,
  },

  /* ============================================================
     ARTS FEST FRAME
  ============================================================ */

  sideLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 142,
    backgroundColor: NAVY,
  },

  sideLeft2: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 112,
    backgroundColor: BLUE_DARK,
    transform: "skewX(-12deg)",
  },

  sideLeft3: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 70,
    backgroundColor: BLUE,
    transform: "skewX(-12deg)",
  },

  sideRight: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 142,
    backgroundColor: NAVY,
  },

  sideRight2: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 112,
    backgroundColor: BLUE_DARK,
    transform: "skewX(12deg)",
  },

  sideRight3: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 70,
    backgroundColor: BLUE,
    transform: "skewX(12deg)",
  },

  accentLeft: {
    position: "absolute",
    left: 70,
    top: 91,
    width: 2,
    height: 69,
    backgroundColor: WHITE,
  },

  accentRight: {
    position: "absolute",
    right: 70,
    top: 91,
    width: 2,
    height: 69,
    backgroundColor: WHITE,
  },

  /* ============================================================
     CENTRAL WATERMARK
  ============================================================ */

  watermark: {
    position: "absolute",
    left: 264,
    top: 177,
    width: 314,
    height: 314,
    borderRadius: 157,
    backgroundColor: PALE,
    opacity: 0.78,
  },

  watermarkSweep: {
    position: "absolute",
    left: 322,
    top: 205,
    width: 205,
    height: 205,
    borderRadius: 102,
    borderWidth: 1,
    borderColor: "#E4EDF6",
    opacity: 0.9,
  },

  /* ============================================================
     TOP BRANDING
  ============================================================ */

  eventLogo: {
    position: "absolute",
    left: 306,
    top: 22,
    width: 230,
    height: 58,
    objectFit: "contain",
  },



  /* ============================================================
     MAIN HEADING
  ============================================================ */

  titleWrap: {
    position: "absolute",
    left: 145,
    right: 145,
    top: 112,
    alignItems: "center",
  },

  title: {
    fontSize: 32,
    fontWeight: "bold",
    letterSpacing: 7.1,
    color: NAVY,
    textAlign: "center",
  },

  subtitleRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  subtitleLine: {
    width: 69,
    height: 1,
    backgroundColor: "#8093A9",
  },

  subtitle: {
    marginLeft: 13,
    marginRight: 13,
    fontSize: 9,
    letterSpacing: 5.2,
    color: NAVY,
  },

  intro: {
    marginTop: 14,
    fontSize: 9,
    letterSpacing: 2.25,
    color: MUTED,
    textAlign: "center",
  },

  participant: {
    marginTop: 13,
    width: 560,
    fontSize: 27,
    fontWeight: "bold",
    letterSpacing: 0.75,
    color: NAVY,
    textAlign: "center",
  },

  participantRule: {
    marginTop: 7,
    width: 420,
    height: 1.2,
    backgroundColor: BLUE,
  },

  securing: {
    marginTop: 7,
    fontSize: 8.8,
    letterSpacing: 2.5,
    color: MUTED,
    textAlign: "center",
  },

  /* ============================================================
     ACHIEVEMENT
  ============================================================ */

  achievementRow: {
    marginTop: 3,
    height: 43,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },


  achievement: {
    fontSize: 25,
    fontWeight: "bold",
    letterSpacing: 1.2,
    color: GOLD,
    textAlign: "center",
  },

  /* ============================================================
     EVENT / CATEGORY / HOUSE
  ============================================================ */

  infoRow: {
    position: "absolute",
    top: 350,
    left: 176,
    right: 176,
    height: 57,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  infoCell: {
    width: 150,
    alignItems: "center",
  },

  divider: {
    width: 1,
    height: 38,
    marginTop: 2,
    backgroundColor: "#6CB2F6",
  },

  label: {
    fontSize: 7.8,
    letterSpacing: 2.45,
    color: MUTED,
    fontWeight: "bold",
    textAlign: "center",
  },

  value: {
    marginTop: 6,
    width: 150,
    fontSize: 10.5,
    lineHeight: 1.2,
    fontWeight: "bold",
    color: NAVY,
    textAlign: "center",
  },

  result: {
    marginTop: 3,
    fontSize: 7,
    color: "#7A899C",
    textAlign: "center",
  },

  /* ============================================================
     RECOGNITION
  ============================================================ */

  recognition: {
    position: "absolute",
    top: 414,
    left: 200,
    right: 200,
    alignItems: "center",
  },

  recognitionText: {
    width: 450,
    fontSize: 8.3,
    lineHeight: 1.55,
    letterSpacing: 2.35,
    color: MUTED,
    textAlign: "center",
  },

  /* ============================================================
     SIGNATURES / DATE
  ============================================================ */

  dateBlock: {
    position: "absolute",
    left: 139,
    bottom: 82,
    width: 130,
    alignItems: "center",
  },

  date: {
    fontSize: 8.7,
    fontWeight: "bold",
    color: NAVY,
    textAlign: "center",
  },

  dateLine: {
    marginTop: 5,
    width: 105,
    height: 1,
    backgroundColor: LIGHT_LINE,
  },

  dateLabel: {
    marginTop: 5,
    fontSize: 7.2,
    letterSpacing: 1.5,
    color: NAVY,
    textAlign: "center",
  },

  sigBlock: {
    position: "absolute",
    bottom: 72,
    width: 160,
    height: 75,
    alignItems: "center",
  },

  sigSports: {
    left: 282,
  },

  sigPrincipal: {
    left: 486,
  },

  signature: {
    width: 112,
    height: 45,
    objectFit: "contain",
    marginBottom: -1,
  },

  sigLine: {
    width: 150,
    height: 1,
    backgroundColor: LIGHT_LINE,
  },

  sigLabel: {
    marginTop: 5,
    fontSize: 8.2,
    color: NAVY,
    textAlign: "center",
  },

  /* ============================================================
     QR
  ============================================================ */




  /* ============================================================
     EVENT FOOTER
  ============================================================ */

  footer: {
    position: "absolute",
    left: 142,
    right: 142,
    bottom: 0,
    height: 57,
    backgroundColor: WHITE,
    borderTopWidth: 1,
    borderTopColor: "#D9E5F0",
    alignItems: "center",
    justifyContent: "center",
  },

  footerTitle: {
    fontSize: 8.5,
    fontWeight: 700,
    color: NAVY,
    textAlign: "center",
    letterSpacing: 1.1,
  },
  footerSubtitle: {
    marginTop: 4,
    fontSize: 6.8,
    color: MUTED,
    textAlign: "center",
    letterSpacing: 0.7,
  },

  /* ============================================================
     CERTIFICATE NUMBER
     Kept ABOVE the footer artwork to prevent overlap.
  ============================================================ */

  certNo: {
    position: "absolute",
    left: 154,
    bottom: 63,
    width: 235,
    flexDirection: "row",
    alignItems: "center",
  },

  certLabel: {
    fontSize: 7.4,
    color: MUTED,
    marginRight: 6,
  },

  certValue: {
    fontSize: 8.4,
    fontWeight: "bold",
    color: NAVY,
  },

  /* ============================================================
     SIDE PANEL COPY
  ============================================================ */

  sideCopyLeft: {
    position: "absolute",
    left: 18,
    bottom: 151,
    width: 78,
    fontSize: 6.8,
    lineHeight: 1.65,
    letterSpacing: 1.3,
    color: WHITE,
    fontWeight: "bold",
  },


  /*
   * Deliberately kept high enough to remain separate from
   * the QR caption.
   */

});

function cleanText(
  value: string | null | undefined,
  fallback = "—"
): string {
  const v = String(value ?? "").trim();
  return v || fallback;
}

function achievementLabel(
  position: number,
  supplied: string
): string {
  const v = String(supplied ?? "").trim();

  if (v) return v;
  if (position === 1) return "CHAMPION";
  if (position === 2) return "RUNNER-UP";
  if (position === 3) return "THIRD PLACE";

  return "ACHIEVEMENT";
}

export function CertificateDocument({
  data,
}: {
  data: CertificateData;
}) {
  const participant = cleanText(
    data.participantName,
    "Participant"
  );

  const event = cleanText(
    data.eventName,
    "SARGAMIYA Event"
  );

  const category = cleanText(data.category);
  const house = cleanText(data.houseName);

  const award = achievementLabel(
    data.position,
    data.achievement
  );

  const result = data.resultValue
    ? `${data.resultValue}${
        data.resultUnit
          ? ` ${data.resultUnit}`
          : ""
      }`
    : "";

  return (
    <Document
      title={`${data.certificateNo} - ${participant}`}
      author="ESRA Global Science Academy"
      subject="SARGAMIYA 2026 Certificate of Achievement"
    >
      <Page
        size="A4"
        orientation="landscape"
        style={styles.page}
      >
        {/* Arts fest frame */}
        <View style={styles.sideLeft} />
        <View style={styles.sideLeft2} />
        <View style={styles.sideLeft3} />

        <View style={styles.sideRight} />
        <View style={styles.sideRight2} />
        <View style={styles.sideRight3} />

        <View style={styles.accentLeft} />
        <View style={styles.accentRight} />

        {/* Subtle central watermark */}
        <View style={styles.watermark} />
        <View style={styles.watermarkSweep} />

        {/* SARGAMIYA — temporary wordmark; replace with supplied official logo */}
        <Image
          src={data.sargamiyaLogo}
          style={styles.eventLogo}
        />

        {/* Side messaging */}
        <Text style={styles.sideCopyLeft}>
          {"CREATIVITY\nEXPRESSION\nCULTURE\nEXCELLENCE"}
        </Text>

        {/* Main certificate heading */}
        <View style={styles.titleWrap}>
          <Text style={styles.title}>
            CERTIFICATE
          </Text>

          <View style={styles.subtitleRow}>
            <View style={styles.subtitleLine} />

            <Text style={styles.subtitle}>
              OF ACHIEVEMENT
            </Text>

            <View style={styles.subtitleLine} />
          </View>

          <Text style={styles.intro}>
            This certificate is proudly presented to
          </Text>

          <Text style={styles.participant}>
            {participant}
          </Text>

          <View style={styles.participantRule} />

          <Text style={styles.securing}>
            for securing
          </Text>

          <View style={styles.achievementRow}>
            <Text style={styles.achievement}>
              {award}
            </Text>
          </View>
        </View>

        {/* Event / Category / House */}
        <View style={styles.infoRow}>
          <View style={styles.infoCell}>
            <Text style={styles.label}>
              EVENT
            </Text>

            <Text style={styles.value}>
              {event}
            </Text>

            {result ? (
              <Text style={styles.result}>
                {result}
              </Text>
            ) : null}
          </View>

          <View style={styles.divider} />

          <View style={styles.infoCell}>
            <Text style={styles.label}>
              CATEGORY
            </Text>

            <Text style={styles.value}>
              {category}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoCell}>
            <Text style={styles.label}>
              HOUSE
            </Text>

            <Text style={styles.value}>
              {house}
            </Text>
          </View>
        </View>

        {/* Recognition */}
        <View style={styles.recognition}>
          <Text style={styles.recognitionText}>
            {"IN RECOGNITION OF CREATIVE EXPRESSION\nAND OUTSTANDING ARTISTIC PERFORMANCE"}
          </Text>
        </View>

        {/* Date */}
        <View style={styles.dateBlock}>
          <Text style={styles.date}>
            {cleanText(data.date)}
          </Text>

          <View style={styles.dateLine} />

          <Text style={styles.dateLabel}>
            DATE
          </Text>
        </View>

        {/* Arts Fest Coordinator */}
        <View
          style={[
            styles.sigBlock,
            styles.sigSports,
          ]}
        >
          <Image
            src={data.artsFestCoordinatorSignature}
            style={styles.signature}
          />

          <View style={styles.sigLine} />

          <Text style={styles.sigLabel}>
            Arts Fest Coordinator
          </Text>
        </View>

        {/* Principal */}
        <View
          style={[
            styles.sigBlock,
            styles.sigPrincipal,
          ]}
        >
          <Image
            src={data.principalSignature}
            style={styles.signature}
          />

          <View style={styles.sigLine} />

          <Text style={styles.sigLabel}>
            Principal
          </Text>
        </View>

        {/* QR verification */}

        {/* Neutral event footer; replace with approved institutional artwork when supplied. */}
        <View style={styles.footer}>
          <Text style={styles.footerTitle}>ESRA GLOBAL SCIENCE ACADEMY</Text>
          <Text style={styles.footerSubtitle}>SARGAMIYA 2026  •  ANNUAL ARTS FEST</Text>
        </View>

        {/* Certificate number is intentionally above the footer. */}
        <View style={styles.certNo}>
          <Text style={styles.certLabel}>
            Certificate No.
          </Text>

          <Text style={styles.certValue}>
            {cleanText(data.certificateNo)}
          </Text>
        </View>
      </Page>
    </Document>
  );
}