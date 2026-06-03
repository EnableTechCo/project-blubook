"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { customerNav } from "@/features/navigation/role-nav";
import { useCustomerJourneyStore } from "@/store/customer-journey-store";

export function CustomerPortalShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const onboardingCompleted = useCustomerJourneyStore(
    (state) => state.onboardingCompleted,
  );

  const isOnboardingRoute = pathname === "/customer/onboarding";

  useEffect(() => {
    if (!isOnboardingRoute && !onboardingCompleted) {
      router.replace("/customer/onboarding");
    }
  }, [isOnboardingRoute, onboardingCompleted, router]);

  if (isOnboardingRoute && !onboardingCompleted) {
    return <>{children}</>;
  }

  if (!onboardingCompleted) {
    return null;
  }

  return (
    <AppShell roleLabel="Customer" navItems={customerNav}>
      {children}
    </AppShell>
  );
}
