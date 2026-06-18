import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "./page";

const signInWithPassword = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace,
    refresh,
  }),
  useSearchParams: () => ({
    get: (key: string) => searchParams.get(key),
  }),
}));

vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword,
    },
  }),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    signInWithPassword.mockReset();
    replace.mockReset();
    refresh.mockReset();
    searchParams = new URLSearchParams();
  });

  it("shows required field validation when inputs are empty", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(
      await screen.findByText("Email and password are required."),
    ).toBeInTheDocument();
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("shows session expired banner when reason is set", () => {
    searchParams = new URLSearchParams("reason=session_expired");

    render(<LoginPage />);

    expect(
      screen.getByText("Your session expired. Please log in again."),
    ).toBeInTheDocument();
  });

  it("shows backend error when sign in fails", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid login credentials" },
    });
    const user = userEvent.setup();

    render(<LoginPage />);

    await user.type(
      screen.getByLabelText("Email address"),
      "person@example.com",
    );
    await user.type(screen.getByLabelText("Password"), "Password123");
    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(
      await screen.findByText("Invalid login credentials"),
    ).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("redirects staff users to the staff dashboard", async () => {
    signInWithPassword.mockResolvedValue({
      data: {
        user: {
          user_metadata: {
            role: "staff",
          },
        },
      },
      error: null,
    });
    const user = userEvent.setup();

    render(<LoginPage />);

    await user.type(
      screen.getByLabelText("Email address"),
      "staff@example.com",
    );
    await user.type(screen.getByLabelText("Password"), "Password123");
    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "staff@example.com",
      password: "Password123",
    });
    expect(replace).toHaveBeenCalledWith("/staff/dashboard");
    expect(refresh).toHaveBeenCalled();
  });

  it("redirects customer users to the customer dashboard", async () => {
    signInWithPassword.mockResolvedValue({
      data: {
        user: {
          user_metadata: {
            role: "customer",
          },
        },
      },
      error: null,
    });
    const user = userEvent.setup();

    render(<LoginPage />);

    await user.type(
      screen.getByLabelText("Email address"),
      "customer@example.com",
    );
    await user.type(screen.getByLabelText("Password"), "Password123");
    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(replace).toHaveBeenCalledWith("/customer/dashboard");
    expect(refresh).toHaveBeenCalled();
  });
});
