import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/features/hub/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-20">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 mb-8 text-sm text-muted">Publish skills, star the ones you like and fork them to make them yours.</p>
      {/* Reads ?next= from the URL at request time */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
