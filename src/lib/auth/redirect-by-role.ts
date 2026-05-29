import { UserRole } from "@/types/domain";
import { ROLE_HOME } from "@/constants/routes";

export function redirectPathByRole(role: UserRole) {
  return ROLE_HOME[role];
}
