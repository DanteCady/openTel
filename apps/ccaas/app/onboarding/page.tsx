"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/logo";
import { getApiUrl } from "@/lib/api";

const STEPS = [
  { id: "email", title: "Your email" },
  { id: "org", title: "Organization" },
  { id: "account", title: "Create account" },
  { id: "done", title: "You're all set" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          organizationName: organizationName.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || data.error || `Registration failed (${res.status})`);
        setLoading(false);
        return;
      }
      setStep(3);
    } catch {
      setError("Network error. Please try again.");
    }
    setLoading(false);
  };

  const currentStepId = STEPS[step]?.id ?? "email";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <Logo size="sm" />
            <span className="font-semibold tracking-tight">OpenTel CCaaS</span>
          </Link>
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-12">
        {/* Progress */}
        <div className="mb-10 flex justify-between gap-2">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`h-1 flex-1 rounded-full ${
                i <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>{STEPS[step]?.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentStepId === "email" && (
              <>
                <p className="text-sm text-muted-foreground">
                  We&apos;ll use this for your account and to contact you.
                </p>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    Email
                  </label>
                  <Input
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-background"
                  />
                </div>
                <Button onClick={() => setStep(1)} disabled={!email.trim()} className="w-full">
                  Next <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </>
            )}

            {currentStepId === "org" && (
              <>
                <p className="text-sm text-muted-foreground">
                  Give your contact center a name (e.g. your company).
                </p>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    Organization name
                  </label>
                  <Input
                    placeholder="Acme Inc"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    className="bg-background"
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(0)} className="flex-1">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                  <Button onClick={() => setStep(2)} className="flex-1">
                    Next <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </>
            )}

            {currentStepId === "account" && (
              <form onSubmit={handleRegister} className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Choose a password for {email}.
                </p>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    Password
                  </label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    className="bg-background"
                  />
                </div>
                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="flex-1"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={password.length < 8 || loading}
                    className="flex-1"
                  >
                    {loading ? "Creating…" : "Create account"}
                  </Button>
                </div>
              </form>
            )}

            {currentStepId === "done" && (
              <>
                <div className="flex justify-center">
                  <CheckCircle2 className="h-16 w-16 text-emerald-500" />
                </div>
                <p className="text-center text-sm text-muted-foreground">
                  Your account is ready. Sign in with your email and password to open the dashboard.
                </p>
                <Button
                  onClick={() => router.push("/login")}
                  className="w-full"
                >
                  Go to sign in <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
