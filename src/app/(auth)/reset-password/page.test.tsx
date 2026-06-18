import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ResetPasswordPage from "./page";

const updateUser = vi.fn();
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
  }),
}));

vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => ({
    auth: {
      updateUser,
    },
  }),
}));

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    updateUser.mockReset();
    push.mockReset();
    vi.useRealTimers();
  });

  it("shows validation message when password is too short", async () => {
    const user = userEvent.setup();
    render(<ResetPasswordPage />);

    await user.type(screen.getByPlaceholderText("New password"), "short");
    await user.type(
      screen.getByPlaceholderText("Confirm new password"),
      "short",
    );
    await user.click(screen.getByRole("button", { name: "Update password" }));

    expect(
      await screen.findByText("Password must be at least 8 characters."),
    ).toBeInTheDocument();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("shows validation message when passwords do not match", async () => {
    const user = userEvent.setup();
    render(<ResetPasswordPage />);

    await user.type(screen.getByPlaceholderText("New password"), "Password123");
    await user.type(
      screen.getByPlaceholderText("Confirm new password"),
      "Password124",
    );
    await user.click(screen.getByRole("button", { name: "Update password" }));

    expect(
      await screen.findByText("Passwords do not match."),
    ).toBeInTheDocument();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("shows backend error message when update fails", async () => {
    updateUser.mockResolvedValue({ error: { message: "Session expired" } });
    const user = userEvent.setup();

    render(<ResetPasswordPage />);

    await user.type(screen.getByPlaceholderText("New password"), "Password123");
    await user.type(
      screen.getByPlaceholderText("Confirm new password"),
      "Password123",
    );
    await user.click(screen.getByRole("button", { name: "Update password" }));

    expect(updateUser).toHaveBeenCalledWith({ password: "Password123" });
    expect(
      await screen.findByText("Password reset failed: Session expired"),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("shows success state and redirects to login", async () => {
    updateUser.mockResolvedValue({ error: null });
    const user = userEvent.setup();

    render(<ResetPasswordPage />);

    await user.type(screen.getByPlaceholderText("New password"), "Password123");
    await user.type(
      screen.getByPlaceholderText("Confirm new password"),
      "Password123",
    );
    await user.click(screen.getByRole("button", { name: "Update password" }));

    expect(
      await screen.findByText("Password updated. Redirecting to login..."),
    ).toBeInTheDocument();

    await waitFor(
      () => {
        expect(push).toHaveBeenCalledWith("/login");
      },
      { timeout: 3000 },
    );
  });

  it("disables button while request is in flight", async () => {
    let releaseRequest: (() => void) | undefined;
    updateUser.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseRequest = () => resolve({ error: null });
        }),
    );

    const user = userEvent.setup();
    render(<ResetPasswordPage />);

    await user.type(screen.getByPlaceholderText("New password"), "Password123");
    await user.type(
      screen.getByPlaceholderText("Confirm new password"),
      "Password123",
    );
    await user.click(screen.getByRole("button", { name: "Update password" }));

    expect(screen.getByRole("button", { name: "Updating..." })).toBeDisabled();

    releaseRequest?.();

    expect(
      await screen.findByText("Password updated. Redirecting to login..."),
    ).toBeInTheDocument();
  });
});
