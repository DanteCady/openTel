"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useSession } from "@/context/session-context";
import { Logo } from "@/components/logo";
import { getApiUrl } from "@/lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { connect, connectionStatus, isAuthenticated } = useSession();
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Email and password are required");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || data.error || `Sign in failed (${res.status})`);
        setLoading(false);
        return;
      }
      const { token, tenantId, endpointId } = data;
      if (!token || !tenantId || !endpointId) {
        setError("Invalid response from server");
        setLoading(false);
        return;
      }
      connect({ tenantId, token, endpointId });
      toast.success("Signed in");
      router.replace("/dashboard");
    } catch {
      setError("Network error. Please try again.");
    }
    setLoading(false);
  };

  if (isAuthenticated || connectionStatus === "connected") {
    router.replace("/dashboard");
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Redirecting…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader className="border-b border-border pb-4">
          <div className="mb-4 flex justify-center">
            <Logo size="lg" />
          </div>
          <CardTitle className="text-center text-lg font-semibold">Sign in</CardTitle>
          <p className="text-sm text-muted-foreground">
            Sign in with your email to open the contact center.
          </p>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-6">
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
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Password
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-background"
                autoComplete="current-password"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button
              type="submit"
              disabled={loading}
              className="w-full"
            >
              {loading ? "Signing in…" : "Sign in"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link href="/onboarding" className="font-medium text-primary hover:underline">
                Get started
              </Link>
            </p>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
