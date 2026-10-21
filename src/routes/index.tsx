import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, bigInput } from "@/components/shared";
import { authService } from "@/services/authService";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Login — Daily Wage Calculator" },
      {
        name: "description",
        content: "Sign in to manage employees, working hours and daily wages.",
      },
      { property: "og:title", content: "Daily Wage Calculator" },
      { property: "og:description", content: "Manage employees and daily wages from your phone." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authService.isLoggedIn()) navigate({ to: "/dashboard" });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return setError("Please enter your username and password.");
    setError("");
    setLoading(true);
    try {
      await authService.login(username, password);
      navigate({ to: "/dashboard" });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Invalid username or password. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border-2 border-border">
            <Wallet className="size-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Daily Wage Calculator</h1>
          <p className="mt-1 text-muted-foreground">Manage employees and daily wages.</p>
        </div>
        <form
          onSubmit={submit}
          className="space-y-4 rounded-2xl border-2 border-border p-5 shadow-card"
          noValidate
        >
          <Field label="Username or Email" htmlFor="u">
            <input
              id="u"
              autoComplete="username"
              className={bigInput}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </Field>
          <Field label="Password" htmlFor="p">
            <div className="relative">
              <input
                id="p"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                className={cn(bigInput, "pr-12")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? "Hide password" : "Show password"}
                className="absolute right-1 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground"
              >
                {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>
          </Field>
          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" size="xl" className="w-full" disabled={loading}>
            {loading && <Loader2 className="animate-spin" />} Login
          </Button>
        </form>
      </div>
    </main>
  );
}
