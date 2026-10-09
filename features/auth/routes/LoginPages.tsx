"use client";

/**
 * The feature's three routes, as `app/login/**` and `app/signup` mount them. `/signup` is the
 * same screen told by its address that it is making an account - the one difference from
 * `/login`. `useSearchParams` needs a Suspense boundary or `next build` refuses the page; the
 * arrival is read once, here.
 */

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { readArrival } from "@/features/auth/lib/arrival";
import { ConfirmScreen } from "@/features/auth/routes/ConfirmScreen";
import { LoginScreen } from "@/features/auth/routes/LoginScreen";

function LoginContent({ signup }: { signup?: boolean }) {
  const params = useSearchParams();
  const [arrival] = useState(() => readArrival(new URLSearchParams(params.toString()), { signup }));
  return <LoginScreen arrival={arrival} />;
}

export function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}

export function SignUpPage() {
  return (
    <Suspense>
      <LoginContent signup />
    </Suspense>
  );
}

export function LoginConfirmPage() {
  return (
    <Suspense>
      <ConfirmScreen />
    </Suspense>
  );
}
