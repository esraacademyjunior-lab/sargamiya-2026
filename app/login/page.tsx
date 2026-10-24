"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.replace("/admin/students");
    router.refresh();
  }

  return (
    <main className="shell loginShell">
      <section className="loginCard">
        <div className="eyebrow">SARGAMIYA 2026 / ADMIN</div>
        <h1>Admin Sign In</h1>
        <p>Sign in to manage students, registrations, results and championship points.</p>
        {error && <div className="errorBox"><div className="errorTitle"><AlertTriangle size={18}/> Sign-in failed</div><p>{error}</p></div>}
        <form onSubmit={signIn} className="loginForm">
          <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></label>
          <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" /></label>
          <button className="primaryButton" disabled={loading}><LogIn size={17}/>{loading ? "Signing in…" : "Sign in"}</button>
        </form>
      </section>
    </main>
  );
}
