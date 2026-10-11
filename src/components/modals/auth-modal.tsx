"use client";

import React, { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { useDemo } from "@/context/demo-context";
import { CheckCircle2, ShieldCheck, LogOut, Sparkles, AlertCircle, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

export function GoogleLogo({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

export function AuthModal({ open, onClose }: AuthModalProps) {
  const { authUser, isGoogleUser, logout, refreshSession, loginWithDemoGoogle } = useDemo();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const supabaseReady = isSupabaseConfigured();

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      if (supabaseReady) {
        const supabase = createClient();
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(window.location.pathname)}`,
            queryParams: {
              access_type: "offline",
              prompt: "consent",
            },
          },
        });
        if (error) throw error;
      } else {
        // Fallback to internal Google OAuth endpoint if configured
        window.location.href = `/api/auth/google?state=${encodeURIComponent(window.location.pathname)}`;
      }
    } catch (err: any) {
      console.error("Google sign-in error:", err);
      setErrorMsg(err.message || "Failed to initiate Google sign in with Supabase");
      setLoading(false);
    }
  };

  const handleDemoSignIn = async (email?: string, name?: string) => {
    try {
      setLoading(true);
      setErrorMsg(null);
      await loginWithDemoGoogle(email, name);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to sign in");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setLoading(true);
      await logout();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to sign out");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={authUser ? "Google Account" : "Sign in to Neighbourlink"}
      description={
        authUser
          ? "Connected and authenticated with Google."
          : "Sign in with your Google account for verified citizen reporting and emergency alerts."
      }
      size="sm"
    >
      <div className="space-y-4 pt-1">
        {errorMsg && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-danger-soft text-danger text-[13px] border border-danger/20">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <p className="flex-1 leading-snug">{errorMsg}</p>
          </div>
        )}

        {authUser ? (
          /* Signed In View */
          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-line bg-surface-2 flex items-center gap-3.5">
              {authUser.avatarUrl ? (
                <img
                  src={authUser.avatarUrl}
                  alt={authUser.name}
                  className="size-12 rounded-full ring-2 ring-accent object-cover"
                />
              ) : (
                <div className="size-12 rounded-full bg-accent text-accent-ink font-semibold text-lg grid place-items-center">
                  {authUser.name.charAt(0)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-ink text-[14px] truncate">{authUser.name}</h4>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-ok-soft text-ok border border-ok/30">
                    <CheckCircle2 className="size-3" />
                    Verified
                  </span>
                </div>
                <p className="text-[12.5px] text-ink-subtle truncate">{authUser.email}</p>
                <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-ink-muted">
                  <GoogleLogo className="size-3.5" />
                  <span>Google Account ({authUser.role})</span>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-surface-2 text-[12.5px] text-ink-muted space-y-1.5">
              <div className="flex items-center gap-2 text-ink font-medium">
                <ShieldCheck className="size-4 text-ok" />
                <span>Civic Identity & Privacy Protection</span>
              </div>
              <p className="leading-relaxed">
                Your incident reports and corroborations are cryptographically tied to this verified identity. Your precise phone number and GPS location remain masked from public viewers.
              </p>
            </div>

            <button
              onClick={handleSignOut}
              disabled={loading}
              className="w-full h-11 rounded-lg border border-danger/30 text-danger hover:bg-danger-soft font-medium text-[13.5px] flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <LogOut className="size-4" />
              {loading ? "Signing out..." : "Sign Out of Google"}
            </button>
          </div>
        ) : (
          /* Sign In Options */
          <div className="space-y-4">
            {/* Standard Google OAuth Button */}
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full h-12 px-4 rounded-xl border border-line bg-surface hover:bg-surface-2 hover:border-ink-subtle text-ink font-medium text-[14px] flex items-center justify-center gap-3 transition-all shadow-sm active:scale-[0.99] disabled:opacity-50"
            >
              <GoogleLogo className="size-5 shrink-0" />
              <span>{loading ? "Connecting to Google..." : "Continue with Google"}</span>
            </button>

            {!supabaseReady && (
              <div className="p-3 rounded-lg border border-line bg-surface-2 text-[12px] text-ink-muted space-y-1">
                <div className="flex items-center gap-1.5 font-medium text-ink">
                  <Database className="size-3.5 text-accent" />
                  <span>Supabase Integration Pending</span>
                </div>
                <p className="leading-relaxed">
                  Add <code className="text-accent font-mono text-[11px]">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="text-accent font-mono text-[11px]">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to your <code className="font-mono text-[11px]">.env</code> file to activate live Supabase Google authentication.
                </p>
              </div>
            )}

            {/* Quick 1-Click Simulation / Local Dev Test */}
            <div className="p-3.5 rounded-xl border border-accent/25 bg-accent-soft/30 space-y-2.5">
              <div className="flex items-center gap-2 text-[12.5px] font-semibold text-accent">
                <Sparkles className="size-4 shrink-0" />
                <span>Instant Developer Sign-In (Local Mode)</span>
              </div>
              <p className="text-[12px] text-ink-muted leading-relaxed">
                Test the complete authenticated session workflow immediately without waiting for Google Cloud Console OAuth setup:
              </p>
              <button
                onClick={() => handleDemoSignIn("roy.asmita0399@gmail.com", "Asmita Roy")}
                disabled={loading}
                className="w-full h-9 rounded-lg bg-accent text-accent-ink hover:opacity-90 font-medium text-[12.5px] flex items-center justify-center gap-2 transition-opacity"
              >
                Sign in as Asmita Roy (Google Verified)
              </button>
            </div>

            <div className="pt-2 border-t border-line text-[11.5px] text-ink-muted flex items-start gap-2">
              <ShieldCheck className="size-4 shrink-0 text-ink-subtle mt-0.5" />
              <p className="leading-relaxed">
                By connecting, you allow Neighbourlink to verify your email and display your verified observer badge on civic incident reports.
              </p>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
