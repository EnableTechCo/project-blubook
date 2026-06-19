"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type UserRow = {
  userId: string;
  email: string;
  fullName: string | null;
  role: string;
  membershipStatus: string;
  organizationId: string | null;
  organizationName: string | null;
  organizationKind: string | null;
  lastLoginAt: string | null;
  activatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type UsersPayload = {
  metrics: {
    total: number;
    byRole: Record<string, number>;
    byStatus: Record<string, number>;
    recentlyActive: number;
  };
  users: UserRow[];
};

export default function AdminUsersPage() {
  const usersQuery = useQuery({
    queryKey: ["admin-users-roster"],
    queryFn: async (): Promise<UsersPayload> => {
      const response = await fetch("/api/admin/users-roster", {
        credentials: "include",
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Could not load users.");
      }

      return {
        metrics: body?.metrics ?? {
          total: 0,
          byRole: {},
          byStatus: {},
          recentlyActive: 0,
        },
        users: (body?.users ?? []) as UserRow[],
      };
    },
    refetchInterval: 60000,
  });

  const roleRows = useMemo(() => {
    const byRole = usersQuery.data?.metrics.byRole ?? {};
    return Object.entries(byRole).sort((a, b) => b[1] - a[1]);
  }, [usersQuery.data?.metrics.byRole]);

  if (usersQuery.isLoading) {
    return <p className="text-sm text-slate-300">Loading users...</p>;
  }

  if (usersQuery.isError) {
    return (
      <p className="text-sm text-red-300">
        {usersQuery.error instanceof Error
          ? usersQuery.error.message
          : "Could not load users."}
      </p>
    );
  }

  const metrics = usersQuery.data?.metrics ?? {
    total: 0,
    byRole: {},
    byStatus: {},
    recentlyActive: 0,
  };
  const users = usersQuery.data?.users ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold text-white">Users & Roles</h2>
          <p className="mt-1 text-sm text-slate-200/85">
            System-wide user roster with role breakdown and activity posture.
          </p>
        </div>
        <Badge>{metrics.total} Users</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Total Users">
          <p className="text-3xl font-semibold text-white">{metrics.total}</p>
        </Card>
        <Card title="Active (30d)">
          <p className="text-3xl font-semibold text-white">
            {metrics.recentlyActive}
          </p>
        </Card>
        <Card title="Roles in Use">
          <p className="text-3xl font-semibold text-white">{roleRows.length}</p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.65fr_1.35fr]">
        <Card
          title="Role Distribution"
          description="How many users hold each access level."
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-200">
              <thead>
                <tr className="border-b border-white/15 text-xs uppercase tracking-[0.08em] text-slate-400">
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Count</th>
                </tr>
              </thead>
              <tbody>
                {roleRows.map(([role, count]) => (
                  <tr key={role} className="border-b border-white/10">
                    <td className="px-3 py-2">{role}</td>
                    <td className="px-3 py-2">{count}</td>
                  </tr>
                ))}
                {roleRows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-slate-400" colSpan={2}>
                      No roles.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>

        <Card
          title="User Roster"
          description="Everyone with a system account — their organisation, role, and when they last signed in."
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-200">
              <thead>
                <tr className="border-b border-white/15 text-xs uppercase tracking-[0.08em] text-slate-400">
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Organization</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Last Login</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.userId} className="border-b border-white/10">
                    <td className="px-3 py-2">
                      <p>{user.fullName ?? "No name"}</p>
                      <p className="text-xs text-slate-400">{user.email}</p>
                    </td>
                    <td className="px-3 py-2">{user.role}</td>
                    <td className="px-3 py-2">
                      {user.organizationName ? (
                        <>
                          <p>{user.organizationName}</p>
                          <p className="text-xs text-slate-400">
                            {user.organizationKind ?? ""}
                          </p>
                        </>
                      ) : (
                        <span className="text-slate-400">No org</span>
                      )}
                    </td>
                    <td className="px-3 py-2">{user.membershipStatus}</td>
                    <td className="px-3 py-2">
                      {user.lastLoginAt
                        ? new Date(user.lastLoginAt).toLocaleString()
                        : "Never"}
                    </td>
                  </tr>
                ))}
                {users.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-slate-400" colSpan={5}>
                      No users found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
