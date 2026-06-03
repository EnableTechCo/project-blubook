export const AUTH_ROUTES = {
  login: "/login",
  register: "/register",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  invite: "/invite",
  verifyEmail: "/verify-email",
} as const;

export const ROLE_HOME = {
  customer: "/customer/requests",
  partner: "/partner/dashboard",
  staff: "/staff/dashboard",
  admin: "/admin/dashboard",
} as const;
