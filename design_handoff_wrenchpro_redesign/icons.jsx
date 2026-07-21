/* global React */
// Minimal stroke-based icon set — sharp, hairline-feel, 16/18px.

const Icon = ({ children, size = 16, stroke = 1.6, ...rest }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={stroke}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...rest}
  >
    {children}
  </svg>
);

const Icons = {
  Wrench: (p) => <Icon {...p}><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.3 2.3-2.7-2.7 2-2.6Z"/></Icon>,
  Dashboard: (p) => <Icon {...p}><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></Icon>,
  Lead: (p) => <Icon {...p}><path d="M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-4Z"/></Icon>,
  Estimate: (p) => <Icon {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/></Icon>,
  Jobs: (p) => <Icon {...p}><rect x="2.5" y="7" width="19" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M2.5 13h19"/></Icon>,
  Calendar: (p) => <Icon {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></Icon>,
  Check: (p) => <Icon {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 12.5 11 15.5 16 9.5"/></Icon>,
  Bolt: (p) => <Icon {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/></Icon>,
  Users: (p) => <Icon {...p}><circle cx="9" cy="8" r="3.5"/><circle cx="17" cy="9.5" r="2.5"/><path d="M2.5 19c0-3 2.5-5 6.5-5s6.5 2 6.5 5"/><path d="M16 14.5c3.2.2 5.5 2.1 5.5 4.5"/></Icon>,
  Car: (p) => <Icon {...p}><path d="M5 13 6.5 8a2 2 0 0 1 2-1.5h7a2 2 0 0 1 2 1.5L19 13"/><path d="M3 18v-3a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3"/><circle cx="7.5" cy="18" r="1.5"/><circle cx="16.5" cy="18" r="1.5"/></Icon>,
  Box: (p) => <Icon {...p}><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/></Icon>,
  Catalog: (p) => <Icon {...p}><path d="M4 4h8a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4V4Z"/><path d="M20 4h-4a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h5V4Z"/></Icon>,
  Shield: (p) => <Icon {...p}><path d="M12 3 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-3Z"/><path d="M9 12.5 11 14.5 15 10"/></Icon>,
  Badge: (p) => <Icon {...p}><circle cx="12" cy="9" r="4"/><path d="M8 13.5 6.5 21l5.5-3 5.5 3-1.5-7.5"/></Icon>,
  Clock: (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></Icon>,
  Dollar: (p) => <Icon {...p}><path d="M12 3v18"/><path d="M16.5 7H10a3 3 0 1 0 0 6h4a3 3 0 1 1 0 6H7"/></Icon>,
  Plan: (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 1.5"/></Icon>,
  Expense: (p) => <Icon {...p}><path d="M12 4v15M5 13l7 7 7-7"/></Icon>,
  Report: (p) => <Icon {...p}><path d="M4 19V5M9 19V9M14 19v-7M19 19v-3"/></Icon>,
  Settings: (p) => <Icon {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></Icon>,
  Search: (p) => <Icon {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></Icon>,
  Plus: (p) => <Icon {...p}><path d="M12 5v14M5 12h14"/></Icon>,
  Bell: (p) => <Icon {...p}><path d="M6 8a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z"/><path d="M10 18a2 2 0 0 0 4 0"/></Icon>,
  ChevDown: (p) => <Icon {...p}><path d="m6 9 6 6 6-6"/></Icon>,
  ChevRight: (p) => <Icon {...p}><path d="m9 6 6 6-6 6"/></Icon>,
  ChevLeft: (p) => <Icon {...p}><path d="m15 6-6 6 6 6"/></Icon>,
  Phone: (p) => <Icon {...p}><path d="M21 16.5v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 3.2 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.5 2.1L7.1 9.6a16 16 0 0 0 6 6l1.1-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.7 2Z"/></Icon>,
  Mail: (p) => <Icon {...p}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></Icon>,
  Pin: (p) => <Icon {...p}><path d="M12 22s-7-7-7-12a7 7 0 1 1 14 0c0 5-7 12-7 12Z"/><circle cx="12" cy="10" r="2.5"/></Icon>,
  Filter: (p) => <Icon {...p}><path d="M4 5h16l-6 8v6l-4-2v-4L4 5Z"/></Icon>,
  More: (p) => <Icon {...p}><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></Icon>,
  Edit: (p) => <Icon {...p}><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/></Icon>,
  Print: (p) => <Icon {...p}><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="7" rx="1"/></Icon>,
  Send: (p) => <Icon {...p}><path d="m3 11 18-8-8 18-2-8-8-2Z"/></Icon>,
  Arrow: (p) => <Icon {...p}><path d="M5 12h14M13 6l6 6-6 6"/></Icon>,
  Truck: (p) => <Icon {...p}><path d="M3 16V6a1 1 0 0 1 1-1h11v11M15 9h4l3 4v3h-7"/><circle cx="7.5" cy="17.5" r="2"/><circle cx="17.5" cy="17.5" r="2"/></Icon>,
  Note: (p) => <Icon {...p}><path d="M4 4h13l3 3v13a0 0 0 0 0 0 0H4V4Z"/><path d="M8 10h8M8 14h8M8 18h5"/></Icon>,
  Pass: (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></Icon>,
  Warn: (p) => <Icon {...p}><path d="m12 3 10 17H2L12 3Z"/><path d="M12 10v4M12 17.5v.5"/></Icon>,
  Fail: (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/></Icon>,
  Close: (p) => <Icon {...p}><path d="M18 6 6 18M6 6l12 12"/></Icon>,
};

window.Icons = Icons;
