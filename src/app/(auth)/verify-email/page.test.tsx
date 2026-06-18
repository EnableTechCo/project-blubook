import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import VerifyEmailPage from "./page";

const getUser = vi.fn();

vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => ({
    auth: {
      getUser,
    },
  }),
}));

describe("VerifyEmailPage", () => {
  beforeEach(() => {
    getUser.mockReset();
  });

  it("shows success state when email is confirmed", async () => {
    getUser.mockResolvedValue({
      data: {
        user: {
          email_confirmed_at: "2026-06-17T00:00:00.000Z",
        },
      },
      error: null,
    });

    render(<VerifyEmailPage />);

    expect(
      await screen.findByText(
        "Email verified successfully. Continue to login.",
      ),
    ).toBeInTheDocument();
  });

  it("shows pending state when email is not yet confirmed", async () => {
    getUser.mockResolvedValue({
      data: {
        user: {
          email_confirmed_at: null,
        },
      },
      error: null,
    });

    render(<VerifyEmailPage />);

    expect(
      await screen.findByText(
        "Email not yet verified. Open the verification link sent to your inbox.",
      ),
    ).toBeInTheDocument();
  });

  it("shows failure state when getUser returns an error", async () => {
    getUser.mockResolvedValue({
      data: {
        user: null,
      },
      error: {
        message: "Session lookup failed",
      },
    });

    render(<VerifyEmailPage />);

    expect(
      await screen.findByText("Verification failed: Session lookup failed"),
    ).toBeInTheDocument();
  });
});
