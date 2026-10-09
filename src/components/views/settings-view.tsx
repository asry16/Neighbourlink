"use client";

import React from "react";
import {
  Server,
  Database,
  Cloud,
  Shield,
  FileCode,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { useDemo } from "@/context/demo-context";

export function SettingsView() {
  const { currentRole } = useDemo();

  const auditEvents = [
    {
      id: "aud-1",
      action: "INCIDENT_REPORT_CREATED",
      actor: "Priya Banerjee (Resident)",
      target: "INC-2026-0042 (Sector V Waterlogging)",
      timestamp: "Today, 14:32 IST",
    },
    {
      id: "aud-2",
      action: "INDEPENDENT_CORROBORATION",
      actor: "Debashis Roy (Resident)",
      target: "INC-2026-0042 (Status -> CORROBORATED)",
      timestamp: "Today, 15:10 IST",
    },
    {
      id: "aud-3",
      action: "SOS_BROADCAST_RECEIVED",
      actor: "Dr. B. K. Mukherjee",
      target: "SOS-2026-0901 (Assigned: KDRRT)",
      timestamp: "Today, 16:45 IST",
    },
    {
      id: "aud-4",
      action: "GEO_COORDINATE_REDACTED",
      actor: "System Security Filter",
      target: "Fuzzed SOS-2026-0901 for Civilian Layer",
      timestamp: "Today, 16:45 IST",
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 md:py-10 max-w-4xl mx-auto w-full space-y-8">
      <header>
        <div className="nl-eyebrow">System</div>
        <h1 className="mt-2 text-[30px] md:text-[36px] font-semibold leading-[1.05] tracking-[-0.03em] text-ink">
          Settings &amp; audit log
        </h1>
        <p className="mt-2 text-[14px] text-ink-muted max-w-xl">
          Integration status, adapter interfaces and the privacy audit trail.
        </p>
      </header>

      {/* Mode Indicator */}
      <div className="p-5 rounded-2xl bg-surface border border-line shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-ink">
                  Runtime Mode: Local Demo Grid
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[12px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                  Active
                </span>
              </div>
              <p className="text-[12.5px] text-ink-subtle">
                Operating fully self-contained without mandatory cloud credentials
              </p>
            </div>
          </div>
        </div>

        {/* Adapter Status Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          <div className="p-3 rounded-xl border border-line bg-surface-2 flex items-start gap-3">
            <Database className="w-4 h-4 text-sky-500 mt-0.5 shrink-0" />
            <div className="text-[12.5px]">
              <span className="font-semibold block text-ink">
                Database Adapter
              </span>
              <span className="text-[12px] text-ink-subtle">
                Local SQLite + Prisma ORM (Deterministic seed active)
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl border border-line bg-surface-2 flex items-start gap-3">
            <Cloud className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
            <div className="text-[12.5px]">
              <span className="font-semibold block text-ink">
                AWS Cloud Boundaries
              </span>
              <span className="text-[12px] text-ink-subtle">
                DynamoDB, Cognito, S3, SQS & SNS adapter interfaces ready
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl border border-line bg-surface-2 flex items-start gap-3">
            <Shield className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
            <div className="text-[12.5px]">
              <span className="font-semibold block text-ink">
                Privacy Protection Filter
              </span>
              <span className="text-[12px] text-ink-subtle">
                Strict coordinate redaction (~1km fuzz) for unauthenticated civilians
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl border border-line bg-surface-2 flex items-start gap-3">
            <FileCode className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <div className="text-[12.5px]">
              <span className="font-semibold block text-ink">
                Experimental Flood Model
              </span>
              <span className="text-[12px] text-ink-subtle">
                Deterministic rule engine v1.0 with transparent contributing factors
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <section className="space-y-3">
        <h3 className="font-semibold text-sm text-ink uppercase tracking-wide">
          Security & Dispatch Audit Trail
        </h3>
        <div className="rounded-2xl border border-line bg-surface overflow-hidden shadow-xs">
          <table className="w-full text-left text-[12.5px]">
            <thead className="bg-surface-2 text-ink-subtle text-[12px] border-b border-line">
              <tr>
                <th className="p-3 font-semibold">Action Event</th>
                <th className="p-3 font-semibold">Actor</th>
                <th className="p-3 font-semibold">Target Entity</th>
                <th className="p-3 font-semibold">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-ink-muted">
              {auditEvents.map((ev) => (
                <tr key={ev.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="p-3 font-mono text-[12px] text-sky-600 dark:text-sky-400 font-medium">
                    {ev.action}
                  </td>
                  <td className="p-3">{ev.actor}</td>
                  <td className="p-3 font-medium">{ev.target}</td>
                  <td className="p-3 text-ink-subtle">{ev.timestamp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
