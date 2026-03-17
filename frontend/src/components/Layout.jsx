import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";

const ROLE_PAGES = {
  SUPER_ADMIN: [
    { key: "overview",  label: "Overview",   icon: "grid"     },
    { key: "users",     label: "Users",       icon: "users"    },
    { key: "groups",    label: "Groups",      icon: "layers"   },
    { key: "events",    label: "Fire Event",  icon: "zap"      },
    { key: "queue",     label: "Queue",       icon: "activity" },
  ],
  TEACHER: [
    { key: "overview",       label: "Overview",      icon: "grid" },
    { key: "notifications",  label: "Notifications", icon: "bell" },
    { key: "events",         label: "Fire Event",    icon: "zap"  },
  ],
  BUS_ADMIN: [
    { key: "overview",       label: "Overview",      icon: "grid" },
    { key: "notifications",  label: "Notifications", icon: "bell" },
    { key: "events",         label: "Fire Event",    icon: "zap"  },
  ],
  LAUNDRY_ADMIN: [
    { key: "overview",       label: "Overview",          icon: "grid"    },
    { key: "notifications",  label: "Notifications",     icon: "bell"    },
    { key: "laundry-admin",  label: "Laundry Dashboard", icon: "washing" },
  ],
  MESS_ADMIN: [
    { key: "overview",       label: "Overview",       icon: "grid"     },
    { key: "notifications",  label: "Notifications",  icon: "bell"     },
    { key: "mess-admin",     label: "Mess Dashboard", icon: "utensils" },
    { key: "events",         label: "Process Refund", icon: "zap"      },
  ],
  STUDENT: [
    { key: "notifications", label: "Notifications", icon: "bell"     },
    { key: "laundry",       label: "Laundry",       icon: "washing"  },
    { key: "mess",          label: "Mess",          icon: "utensils" },
    { key: "groups",        label: "My Groups",     icon: "layers"   },
    { key: "profile",       label: "Profile",       icon: "user"     },
  ],
};

const ICONS = {
  grid:     <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
  users:    <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
  layers:   <><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></>,
  zap:      <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>,
  activity: <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></>,
  bell:     <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>,
  user:     <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
  logout:   <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
  washing:  <><path d="M3 6l1 14h16l1-14H3z"/><circle cx="12" cy="13" r="3"/><path d="M7 6V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v2"/><circle cx="7" cy="9" r="1" fill="currentColor"/></>,
  utensils: <><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></>,
};

function Icon({ name, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </svg>
  );
}

function initials(name = "") {
  return name.split(" ").map(w => w[0]).filter(Boolean).join("").slice(0, 2).toUpperCase();
}

const PAGE_TITLES = {
  overview:        "Overview",
  users:           "User Management",
  groups:          "Groups",
  events:          "Fire Event",
  queue:           "Queue Status",
  notifications:   "Notifications",
  laundry:         "Laundry Booking",
  mess:            "Mess",
  "laundry-admin": "Laundry Dashboard",
  "mess-admin":    "Mess Dashboard",
  profile:         "My Profile",
};

function getPageTitle(page, role) {
  if (page === "events" && role === "MESS_ADMIN") return "Process Refund";
  return PAGE_TITLES[page] || page;
}

const ROLE_BADGE = {
  SUPER_ADMIN:   "red",
  TEACHER:       "blue",
  BUS_ADMIN:     "amber",
  LAUNDRY_ADMIN: "green",
  MESS_ADMIN:    "green",
  STUDENT:       "gray",
};

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navItems = ROLE_PAGES[user.role] || ROLE_PAGES.STUDENT;
  const defaultPage =
    user.role === "STUDENT"       ? "notifications"  :
    user.role === "LAUNDRY_ADMIN" ? "laundry-admin"  :
    user.role === "MESS_ADMIN"    ? "mess-admin"      :
    "overview";
  const [page, setPage] = useState(defaultPage);

  const child = typeof children === "function"
    ? children(page, setPage)
    : React.cloneElement(children, { currentPage: page, setPage });

  return (
    <div className="app">
      {/* ── Sidebar ── */}
      <aside className="sidebar">

        {/* Brand */}
        <div className="sidebar-logo">
          <div className="logo-mark">
            <div className="logo-icon">
              <span className="logo-dot-c"></span>
              <span className="logo-dot-d"></span>
            </div>
            <div className="logo-text">
              <div className="wordmark">Smart Campus</div>
              <div className="tagline">Campus connect system</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          <div className="nav-section">Menu</div>
          {navItems.map(item => (
            <button
              key={item.key}
              className={`nav-item ${page === item.key ? "active" : ""}`}
              onClick={() => setPage(item.key)}
            >
              <Icon name={item.icon} size={16} />
              {item.label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="avatar">{initials(user.name)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="user-name">{user.name}</div>
              <div className="user-role">{user.role.replace(/_/g, " ")}</div>
            </div>
          </div>
          <button className="logout-btn" onClick={logout}>
            <Icon name="logout" size={15} />
            Sign out
          </button>
        </div>

      </aside>

      {/* ── Main ── */}
      <div className="main-content">
        <div className="topbar">
          <span className="topbar-title">{getPageTitle(page, user.role)}</span>
          <div className="topbar-right">
            <span className={`badge badge-${ROLE_BADGE[user.role] || "gray"}`}>
              {user.role.replace(/_/g, " ")}
            </span>
          </div>
        </div>
        <div className="page">{child}</div>
      </div>
    </div>
  );
}