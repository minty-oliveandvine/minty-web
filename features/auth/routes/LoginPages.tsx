"use client";

/**
 * The feature's two routes, as `app/login/**` mounts them. `useSearchParams` needs a Suspense
 * boundary or `next build` refuses the page; the arrival is read once, here.
 */

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { readArrival } from "@/features/auth/lib/arrival";
import { ConfirmScreen } from "@/features/auth/routes/ConfirmScreen";
import { LoginScreen } from "@/features/auth/routes/LoginScreen";

function LoginContent() {
  const params = useSearchParams();
  const [arrival] = useState(() => readArrival(new URLSearchParams(params.toString())));
  return <LoginScreen arrival={arrival} />;
}

export function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
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
