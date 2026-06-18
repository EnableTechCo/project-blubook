import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import ForgotPasswordPage from "./page";

const resetPasswordForEmail = vi.fn();

vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => ({
    auth: {
      resetPasswordForEmail,
    },
  }),
}));

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    resetPasswordForEmail.mockReset();
  });

  it("submits email and shows success status", async () => {
    resetPasswordForEmail.mockResolvedValue({ error: null });
    const user = userEvent.setup();

    render(<ForgotPasswordPage />);

    const emailInput = screen.getByPlaceholderText("you@company.com");
    await user.type(emailInput, "person@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(resetPasswordForEmail).toHaveBeenCalledWith("person@example.com", {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    expect(
      await screen.findByText("Password reset email sent. Check your inbox."),
    ).toBeInTheDocument();
  });

  it("shows an error status when reset request fails", async () => {
    resetPasswordForEmail.mockResolvedValue({
      error: { message: "Request blocked" },
    });
    const user = userEvent.setup();

    render(<ForgotPasswordPage />);

    await user.type(
      screen.getByPlaceholderText("you@company.com"),
      "person@example.com",
    );
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(
      await screen.findByText("Reset request failed: Request blocked"),
    ).toBeInTheDocument();
  });

  it("disables the button while request is in flight", async () => {
    let releaseRequest: (() => void) | undefined;
    resetPasswordForEmail.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseRequest = () => resolve({ error: null });
        }),
    );
    const user = userEvent.setup();

    render(<ForgotPasswordPage />);

    const button = screen.getByRole("button", { name: "Send reset link" });
    await user.type(
      screen.getByPlaceholderText("you@company.com"),
      "person@example.com",
    );
    await user.click(button);

    expect(screen.getByRole("button", { name: "Sending..." })).toBeDisabled();

    releaseRequest?.();

    expect(
      await screen.findByText("Password reset email sent. Check your inbox."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Send reset link" }),
    ).toBeEnabled();
  });
});
