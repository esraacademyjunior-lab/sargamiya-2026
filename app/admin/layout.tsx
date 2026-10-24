import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import {
  Activity,
  Award,
  BarChart3,
  CalendarDays,
  ClipboardList,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Radio,
  Settings,
  Trophy,
  Users,
  UserPlus,
  UserSearch,
  Swords,
  Scale,
} from "lucide-react";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="adminShell">
      {/* =====================================================
          DESKTOP SIDEBAR
      ====================================================== */}
      <aside className="adminSidebar">
        {/* Brand */}
        <div className="adminBrand">
          <Link href="/admin" className="adminBrandLink">
            <div className="adminBrandMark">
              <Trophy size={19} />
            </div>

            <div className="adminBrandText">
              <strong>SARGAMIYA</strong>
              <span>ADMIN PANEL</span>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="adminNavigation">
          {/* Main */}
          <AdminSection title="Main">
            <AdminLink
              href="/admin"
              icon={<LayoutDashboard size={17} />}
              label="Overview"
            />
          </AdminSection>

          {/* Student Management */}
          <AdminSection title="Student Management">
            <AdminLink
              href="/admin/students"
              icon={<Users size={17} />}
              label="Students"
            />

            <AdminLink
              href="/admin/students/lookup"
              icon={<UserSearch size={17} />}
              label="Chest Lookup"
            />

            <AdminLink
              href="/admin/students/new"
              icon={<UserPlus size={17} />}
              label="Add Student"
            />
          </AdminSection>

          {/* Competitions */}
          <AdminSection title="Competitions">
            <AdminLink
              href="/admin/events"
              icon={<Swords size={17} />}
              label="Events"
            />

            <AdminLink
              href="/admin/registrations"
              icon={<ClipboardList size={17} />}
              label="Registrations"
            />

            <AdminLink
              href="/admin/teams"
              icon={<Users size={17} />}
              label="Group Rosters"
            />

            <AdminLink
              href="/admin/results"
              icon={<Trophy size={17} />}
              label="Results"
            />

            <AdminLink
              href="/admin/judging"
              icon={<Scale size={17} />}
              label="Judging & Scores"
            />

            <AdminLink
              href="/admin/certificates"
              icon={<Award size={17} />}
              label="Certificates"
            />

            <AdminLink
              href="/admin/points"
              icon={<Activity size={17} />}
              label="House Points"
            />

            <AdminLink
              href="/admin/schedule"
              icon={<CalendarDays size={17} />}
              label="Schedule"
            />

            <AdminLink
              href="/admin/live"
              icon={<Radio size={17} />}
              label="Live Control Room"
            />
          </AdminSection>

          {/* Insights */}
          <AdminSection title="Insights">
            <AdminLink
              href="/admin/analytics"
              icon={<BarChart3 size={17} />}
              label="Analytics"
            />
          </AdminSection>

          {/* System */}
          <AdminSection title="System">
            <AdminLink
              href="/admin/supabase-test"
              icon={<Settings size={17} />}
              label="Supabase Test"
            />
          </AdminSection>
        </nav>

        {/* User section */}
        <div className="adminUserPanel">
          <div className="adminUserCard">
            <span>Signed in as</span>
            <strong>{user.email}</strong>
          </div>

          <div className="adminUserActions">
            <Link href="/" className="adminWebsiteButton">
              <ExternalLink size={14} />
              <span>Website</span>
            </Link>

            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="adminSignOutButton"
                title="Sign out"
              >
                <LogOut size={15} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* =====================================================
          MOBILE HEADER
      ====================================================== */}
      <header className="adminMobileHeader">
        <Link href="/admin" className="adminMobileBrand">
          <div className="adminMobileBrandMark">
            <Trophy size={18} />
          </div>

          <div>
            <strong>SARGAMIYA</strong>
            <span>ADMIN</span>
          </div>
        </Link>

        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="adminMobileSignOut"
            title="Sign out"
          >
            <LogOut size={17} />
          </button>
        </form>
      </header>

      {/* =====================================================
          MAIN CONTENT
      ====================================================== */}
      <main className="adminMain">
        {children}
      </main>
    </div>
  );
}

/* =============================================================
   ADMIN SECTION
============================================================= */

function AdminSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="adminNavSection">
      <p className="adminNavSectionTitle">{title}</p>
      <div className="adminNavItems">{children}</div>
    </div>
  );
}

/* =============================================================
   ADMIN NAVIGATION LINK
============================================================= */

function AdminLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link href={href} className="adminNavLink">
      <span className="adminNavIcon">{icon}</span>
      <span className="adminNavLabel">{label}</span>
    </Link>
  );
}