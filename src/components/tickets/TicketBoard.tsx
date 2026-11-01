"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppNav } from "@/components/AppNav";
import type { TicketStatus, TicketView } from "@/lib/api-types";
import { CATEGORY_KEYS, LanguageToggle, useLang, type MessageKey } from "@/lib/i18n";
import { CATEGORY_COLORS } from "@/lib/survey-analytics";
import type { ApiError, RootCause } from "@/lib/survey-cleaner";

type Filter = "all" | "open" | "overdue" | "contacted" | "resolved" | "unreachable";

const FILTERS: { key: Filter; label: MessageKey }[] = [
  { key: "open", label: "tkOpen" },
  { key: "overdue", label: "tkOverdue" },
  { key: "contacted", label: "tkContacted" },
  { key: "resolved", label: "tkResolved" },
  { key: "unreachable", label: "tkUnreachable" },
  { key: "all", label: "tkAll" },
];

const HOUR = 3_600_000;
const isRootCause = (v: string | null): v is RootCause => v === "service" || v === "parts" || v === "product" || v === "other";

const buttonClass =
  "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0E8A8F]";

function TicketCard({
  ticket,
  now,
  busy,
  onStatus,
  onNotes,
}: {
  ticket: TicketView;
  now: number;
  busy: boolean;
  onStatus: (status: TicketStatus) => void;
  onNotes: (notes: string) => void;
}) {
  const { t, lang, reason, place } = useLang();
  const [notes, setNotes] = useState(ticket.notes ?? "");
  const notesChanged = notes !== (ticket.notes ?? "");

  const due = new Date(ticket.due_at).getTime();
  const waiting = ticket.status === "open";
  const hoursLate = Math.round((now - due) / HOUR);
  const overdue = waiting && now > due;

  const dueText = new Date(ticket.due_at).toLocaleString(lang === "ar" ? "ar-EG" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const score = (label: string, value: number | null) =>
    value === null ? null : (
      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums">
        {label} {value}
      </span>
    );

  return (
    <li
      className="rounded-xl border border-slate-200 bg-white p-4"
      style={{ borderInlineStart: `4px solid ${overdue ? "#D6453D" : ticket.status === "resolved" ? "#1F9D6B" : "#E0A100"}` }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {ticket.phone ? (
            <a href={`tel:${ticket.phone}`} dir="ltr" className="font-mono text-base font-semibold underline-offset-2 hover:underline">
              {ticket.phone}
            </a>
          ) : (
            <span className="text-slate-400">-</span>
          )}
          {ticket.customer_name && <div className="text-sm text-slate-600">{ticket.customer_name}</div>}
        </div>

        <div className="text-end text-sm">
          {waiting && (
            <p className={overdue ? "font-medium text-red-700" : "text-slate-700"}>
              {overdue ? t("tkOverdueBy", { h: hoursLate }) : t("tkLeft", { h: Math.max(0, -hoursLate) })}
            </p>
          )}
          <p className="text-xs text-slate-500">{t("tkDue", { date: dueText })}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        {score("CSAT", ticket.csat)}
        {score("NPS", ticket.nps)}
        {ticket.vehicle_model && <span dir="ltr">{ticket.vehicle_model}</span>}
        {ticket.governorate && <span className="text-slate-600">{place(ticket.governorate)}</span>}
        {ticket.service_center && <span className="text-slate-600">{ticket.service_center}</span>}
        {isRootCause(ticket.root_cause) && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[ticket.root_cause] }} />
            {t(CATEGORY_KEYS[ticket.root_cause])}
            {ticket.root_cause_detail && <span className="text-slate-600">: {reason(ticket.root_cause_detail)}</span>}
          </span>
        )}
        {ticket.survey_date && (
          <span className="text-xs text-slate-500">
            {t("tkSurveyDate")}: {ticket.survey_date}
          </span>
        )}
      </div>

      {ticket.comment && <p className="mt-2 rounded-lg bg-slate-50 p-2 text-sm">{ticket.comment}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        {ticket.status !== "contacted" && (
          <button type="button" disabled={busy} onClick={() => onStatus("contacted")} className={buttonClass}>
            {t("tkBtnContacted")}
          </button>
        )}
        {ticket.status !== "resolved" && (
          <button type="button" disabled={busy} onClick={() => onStatus("resolved")} className={buttonClass}>
            {t("tkBtnResolved")}
          </button>
        )}
        {ticket.status !== "unreachable" && (
          <button type="button" disabled={busy} onClick={() => onStatus("unreachable")} className={buttonClass}>
            {t("tkBtnUnreachable")}
          </button>
        )}
        {ticket.status !== "open" && (
          <button type="button" disabled={busy} onClick={() => onStatus("open")} className={buttonClass}>
            {t("tkBtnReopen")}
          </button>
        )}
      </div>

      <div className="mt-3">
        <label className="text-sm text-slate-600" htmlFor={`notes-${ticket.id}`}>
          {t("tkNotes")}
        </label>
        <textarea
          id={`notes-${ticket.id}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("tkNotesPlaceholder")}
          rows={2}
          maxLength={2000}
          className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0E8A8F]"
        />
        {notesChanged && (
          <button type="button" disabled={busy} onClick={() => onNotes(notes)} className={`${buttonClass} mt-2`}>
            {t("tkSaveNotes")}
          </button>
        )}
      </div>
    </li>
  );
}

export function TicketBoard() {
  const { t, dir } = useLang();
  const [tickets, setTickets] = useState<TicketView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("open");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/tickets", { cache: "no-store" });
      const json = (await response.json().catch(() => null)) as { tickets?: TicketView[] } | ApiError | null;
      if (!response.ok || !json || !("tickets" in json) || !json.tickets) {
        const err = json as Partial<ApiError> | null;
        setError(err?.code === "not_configured" ? t("errDbNotConfigured") : (err?.error ?? t("tkLoadError")));
        setTickets([]);
        return;
      }
      setTickets(json.tickets);
      setNow(Date.now());
    } catch {
      setError(t("errNetwork"));
      setTickets([]);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function update(id: string, body: { status?: TicketStatus; notes?: string }) {
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch("/api/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      if (!response.ok) {
        const err = (await response.json().catch(() => null)) as Partial<ApiError> | null;
        setError(err?.error ?? t("tkUpdateError"));
        return;
      }
      await load();
    } catch {
      setError(t("errNetwork"));
    } finally {
      setBusyId(null);
    }
  }

  const counts = useMemo(() => {
    const c = { all: 0, open: 0, overdue: 0, contacted: 0, resolved: 0, unreachable: 0 };
    for (const tk of tickets ?? []) {
      c.all++;
      c[tk.status]++;
      if (tk.status === "open" && new Date(tk.due_at).getTime() < now) c.overdue++;
    }
    return c;
  }, [tickets, now]);

  const visible = useMemo(() => {
    const list = tickets ?? [];
    if (filter === "all") return list;
    if (filter === "overdue") return list.filter((tk) => tk.status === "open" && new Date(tk.due_at).getTime() < now);
    return list.filter((tk) => tk.status === filter);
  }, [tickets, filter, now]);

  return (
    <main dir={dir} className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("ticketsTitle")}</h1>
          <p className="mt-1 max-w-prose text-sm text-slate-600">{t("ticketsIntro")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AppNav />
          <LanguageToggle />
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2" role="tablist">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(f.key)}
              className={`rounded-md border px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0E8A8F] ${
                active ? "border-[#0F2A33] bg-[#0F2A33] text-white" : "border-slate-300 bg-white hover:bg-slate-50"
              } ${f.key === "overdue" && counts.overdue > 0 && !active ? "border-red-300 text-red-700" : ""}`}
            >
              {t(f.label)} <span className="tabular-nums">({counts[f.key]})</span>
            </button>
          );
        })}
        <button type="button" onClick={() => void load()} className={`${buttonClass} ms-auto`}>
          {t("tkRefresh")}
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          {error}
        </p>
      )}

      {tickets === null ? (
        <p className="text-sm text-slate-600">{t("tkLoading")}</p>
      ) : visible.length === 0 ? (
        !error && <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600">{t("tkNone")}</p>
      ) : (
        <ul className="space-y-3">
          {visible.map((tk) => (
            <TicketCard
              key={tk.id}
              ticket={tk}
              now={now}
              busy={busyId === tk.id}
              onStatus={(status) => void update(tk.id, { status })}
              onNotes={(notes) => void update(tk.id, { notes })}
            />
          ))}
        </ul>
      )}
    </main>
  );
}
