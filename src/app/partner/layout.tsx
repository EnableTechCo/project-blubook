import { PartnerShell } from "@/components/shell/partner-shell";

export default function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PartnerShell>{children}</PartnerShell>;
}
