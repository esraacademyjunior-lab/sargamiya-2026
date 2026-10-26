"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Images, RefreshCw, Tv2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Photo = { id: string; title: string | null; event_name: string | null; photo_url: string; created_at: string };

export default function HighlightsPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { data, error: queryError } = await supabase
        .from("live_highlights")
        .select("id,title,event_name,photo_url,created_at")
        .eq("is_published", true)
        .order("created_at", { ascending: false });
      if (queryError) throw queryError;
      setPhotos((data ?? []) as Photo[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load photographs. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <main className="highlightsPage">
      <header className="highlightsTopbar">
        <Link href="/" className="highlightsBrand" aria-label="Sargamiya home">SARGAMIYA <span>2026</span></Link>
        <nav aria-label="Highlights navigation">
          <Link href="/live"><Tv2 size={17} /> Live Dashboard</Link>
          <Link href="/schedule">Schedule</Link>
        </nav>
      </header>
      <section className="highlightsHero">
        <div className="highlightsEyebrow"><Images size={16} /> THE FESTIVAL IN FRAMES</div>
        <h1>Moments worth <span>remembering.</span></h1>
        <p>Explore the latest approved photographs from Sargamiya 2026 — performances, creativity, teamwork and celebration.</p>
        <div className="highlightsHeroActions">
          <Link href="/live" className="highlightsPrimary"><Tv2 size={17} /> Open Live Dashboard</Link>
          <button type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={16} className={loading ? "highlightsSpin" : ""} /> Refresh photos</button>
        </div>
      </section>
      <section className="highlightsGallerySection">
        <div className="highlightsSectionHeading"><div><span>PHOTO GALLERY</span><h2>Festival highlights</h2></div><p>{photos.length} {photos.length === 1 ? "photograph" : "photographs"}</p></div>
        {error && <div className="highlightsMessage" role="alert">{error}</div>}
        {loading ? <div className="highlightsEmpty">Loading photographs…</div> : photos.length === 0 ? <div className="highlightsEmpty"><Images size={34} /><strong>Photos are on the way</strong><span>Approved event photographs will appear here as they are published.</span></div> :
          <div className="highlightsGallery">{photos.map((photo) => <article className="highlightsPhoto" key={photo.id}><a href={photo.photo_url} target="_blank" rel="noreferrer" aria-label={`Open ${photo.title || photo.event_name || "event photograph"}`}><img src={photo.photo_url} alt={photo.title || photo.event_name || "Sargamiya 2026 event photograph"} loading="lazy" /></a><div className="highlightsPhotoCaption"><span>{photo.event_name || "Sargamiya 2026"}</span><h3>{photo.title || "A festival moment"}</h3><time dateTime={photo.created_at}>{new Date(photo.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</time></div></article>)}</div>}
      </section>
      <footer className="highlightsFooter"><Link href="/" className="highlightsBack"><ArrowLeft size={16} /> Back to Sargamiya home</Link><span>ESRA Global Science Academy · SARGAMIYA 2026</span></footer>
      <style jsx global>{`
        .highlightsPage{min-height:100vh;background:#f5f7fc;color:#0a1932;font-family:Geist,Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
        .highlightsTopbar{height:auto;min-height:72px;padding:12px clamp(16px,4vw,64px);display:flex;align-items:center;justify-content:space-between;gap:16px;background:#071a3a;color:white}
        .highlightsBrand{font-weight:950;letter-spacing:-.055em;color:white;text-decoration:none;font-size:22px}.highlightsBrand span{color:#64d5ff}
        .highlightsTopbar nav{display:flex;align-items:center;gap:clamp(12px,2.4vw,32px);flex-wrap:wrap}.highlightsTopbar nav a{display:inline-flex;align-items:center;gap:7px;color:#d8e7fa;text-decoration:none;font-size:14px;font-weight:700;min-height:42px}
        .highlightsHero{padding:clamp(30px,6vw,76px) clamp(18px,7vw,100px) 42px;background:radial-gradient(ellipse at 85% 0%,rgba(54,132,255,.22),transparent 44%),linear-gradient(135deg,#071a3a,#102b54);color:white}
        .highlightsEyebrow{display:flex;align-items:center;gap:8px;font-size:12px;letter-spacing:.14em;font-weight:850;color:#9adfff}.highlightsHero h1{max-width:850px;margin:16px 0;font-size:clamp(36px,6vw,72px);line-height:1.02;letter-spacing:-.06em}.highlightsHero h1 span{color:#72dcff}.highlightsHero>p{max-width:680px;color:#c4d3e8;font-size:clamp(15px,1.6vw,18px);line-height:1.65}.highlightsHeroActions{display:flex;gap:10px;flex-wrap:wrap;margin-top:24px}.highlightsHeroActions a,.highlightsHeroActions button{display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:46px;padding:0 17px;border-radius:12px;font-size:14px;font-weight:800;text-decoration:none}.highlightsPrimary{background:#68d7ff;color:#062044}.highlightsHeroActions button{background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.2);color:white;cursor:pointer}.highlightsGallerySection{max-width:1500px;margin:auto;padding:clamp(24px,4vw,54px) clamp(16px,4vw,54px) 60px}.highlightsSectionHeading{display:flex;justify-content:space-between;align-items:end;gap:16px;margin-bottom:22px}.highlightsSectionHeading span{font-size:11px;font-weight:900;letter-spacing:.15em;color:#3174d8}.highlightsSectionHeading h2{font-size:clamp(26px,3vw,38px);letter-spacing:-.045em;margin:6px 0 0}.highlightsSectionHeading>p{font-weight:750;color:#66748b;font-size:14px}.highlightsGallery{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}.highlightsPhoto{min-width:0;overflow:hidden;border-radius:18px;background:white;border:1px solid #e0e7f0;box-shadow:0 8px 26px rgba(20,42,78,.06)}.highlightsPhoto>a{display:block;background:#eaf0f8;aspect-ratio:4/3;overflow:hidden}.highlightsPhoto img{display:block;width:100%;height:100%;object-fit:cover;transition:transform .3s ease}.highlightsPhoto>a:hover img{transform:scale(1.035)}.highlightsPhotoCaption{padding:15px 17px 17px}.highlightsPhotoCaption>span{font-size:11px;text-transform:uppercase;letter-spacing:.1em;font-weight:850;color:#3974c9}.highlightsPhotoCaption h3{font-size:18px;line-height:1.3;margin:6px 0 8px;overflow-wrap:anywhere}.highlightsPhotoCaption time{font-size:12px;color:#78869b}.highlightsEmpty{min-height:190px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;padding:28px;background:white;border:1px dashed #cbd7e7;border-radius:18px;color:#64748b}.highlightsEmpty strong{color:#142743;font-size:18px}.highlightsEmpty span{font-size:14px}.highlightsMessage{padding:14px 16px;margin-bottom:18px;background:#fff0f0;border:1px solid #ffd1d1;border-radius:12px;color:#9b2424;overflow-wrap:anywhere}.highlightsFooter{padding:22px clamp(16px,4vw,54px);display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;border-top:1px solid #e1e7ef;color:#738096;font-size:12px}.highlightsBack{display:inline-flex;align-items:center;gap:7px;color:#1c4c8c;font-weight:800;text-decoration:none}.highlightsSpin{animation:highlightsRotate .8s linear infinite}@keyframes highlightsRotate{to{transform:rotate(360deg)}}
        @media(max-width:900px){.highlightsGallery{grid-template-columns:repeat(2,minmax(0,1fr))}.highlightsHero{padding-top:42px}}
        @media(max-width:560px){.highlightsTopbar{align-items:flex-start;flex-direction:column;gap:6px;padding:12px 16px}.highlightsTopbar nav{width:100%;gap:16px}.highlightsTopbar nav a{font-size:13px}.highlightsHero{padding:34px 18px 30px}.highlightsHero h1{font-size:clamp(34px,10vw,48px)}.highlightsHeroActions{display:grid;grid-template-columns:1fr}.highlightsHeroActions a,.highlightsHeroActions button{width:100%}.highlightsSectionHeading{align-items:flex-start;flex-direction:column;gap:6px}.highlightsGallery{grid-template-columns:1fr;gap:14px}.highlightsPhoto>a{aspect-ratio:5/4}.highlightsPhotoCaption{padding:13px 14px}.highlightsFooter{flex-direction:column}}
        @media(prefers-reduced-motion:reduce){.highlightsPage *{scroll-behavior:auto!important;animation-duration:.01ms!important;transition-duration:.01ms!important}}
      `}</style>
    </main>
  );
}
