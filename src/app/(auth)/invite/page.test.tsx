import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InvitePage from "./page";

const signInWithPassword = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => searchParams.get(key),
  }),
}));

vi.mock("@/features/auth/invite-debug", () => ({
  parseInviteMember: () => ({
    email: "",
    name: "",
  }),
}));

vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword,
    },
  }),
}));

describe("InvitePage", () => {
  beforeEach(() => {
    searchParams = new URLSearchParams();
    signInWithPassword.mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("shows missing link details message when invite token/email are absent", async () => {
    render(<InvitePage />);

    expect(
      screen.getByRole("button", { name: "Activate account" }),
    ).toBeDisabled();
  });

  it("shows invite verification failure when activation endpoint returns error", async () => {
    searchParams = new URLSearchParams(
      "token=abc123&email=user@example.com&name=User",
    );
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Invite is expired" }),
    } as Response);

    const user = userEvent.setup();
    render(<InvitePage />);

    await user.type(
      screen.getByPlaceholderText("Create password"),
      "Password123",
    );
    await user.click(screen.getByRole("button", { name: "Activate account" }));

    expect(
      await screen.findByText("Invite verification failed: Invite is expired"),
    ).toBeInTheDocument();
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("shows login failure message after successful activation", async () => {
    searchParams = new URLSearchParams(
      "token=abc123&email=user@example.com&name=User",
    );
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);
    signInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });

    const user = userEvent.setup();
    render(<InvitePage />);

    await user.type(
      screen.getByPlaceholderText("Create password"),
      "Password123",
    );
    await user.click(screen.getByRole("button", { name: "Activate account" }));

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "Password123",
    });
    expect(
      await screen.findByText(
        "Account activated, but login failed: Invalid login credentials",
      ),
    ).toBeInTheDocument();
  });

  it("shows success message after activation and login", async () => {
    searchParams = new URLSearchParams(
      "token=abc123&email=user@example.com&name=User",
    );
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);
    signInWithPassword.mockResolvedValue({ error: null });

    const user = userEvent.setup();
    render(<InvitePage />);

    await user.type(
      screen.getByPlaceholderText("Create password"),
      "Password123",
    );
    await user.click(screen.getByRole("button", { name: "Activate account" }));

    expect(
      await screen.findByText(
        "Invite accepted. You can now continue into the platform.",
      ),
    ).toBeInTheDocument();
  });
});
