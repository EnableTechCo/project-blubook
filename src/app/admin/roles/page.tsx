"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectMenu } from "@/components/ui/select-menu";

type RoleUserRow = {
  userId: string;
  fullName: string | null;
  email: string;
  role: string;
  membershipStatus: string;
  lastLoginAt: string | null;
  organizationId: string | null;
  organizationName: string | null;
  organizationKind: string | null;
  createdAt: string;
  updatedAt: string;
};

type RolesPayload = {
  availableRoles: string[];
  metrics: {
    total: number;
    byRole: Record<string, number>;
    byStatus: Record<string, number>;
  };
  users: RoleUserRow[];
};

export default function AdminRolesPage() {
  const queryClient = useQueryClient();
  const [pendingRoleByUser, setPendingRoleByUser] = useState<
    Record<string, string>
  >({});
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const rolesQuery = useQuery({
    queryKey: ["admin-role-management"],
    queryFn: async (): Promise<RolesPayload> => {
      const response = await fetch("/api/admin/roles", {
        credentials: "include",
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Could not load role management data.");
      }

      return {
        availableRoles: (body?.availableRoles ?? []) as string[],
        metrics: {
          total: body?.metrics?.total ?? 0,
          byRole: (body?.metrics?.byRole ?? {}) as Record<string, number>,
          byStatus: (body?.metrics?.byStatus ?? {}) as Record<string, number>,
        },
        users: (body?.users ?? []) as RoleUserRow[],
      };
    },
  });

  const users = rolesQuery.data?.users ?? [];
  const availableRoles = rolesQuery.data?.availableRoles ?? [];
  const roleRows = useMemo(
    () =>
      Object.entries(rolesQuery.data?.metrics.byRole ?? {}).sort(
        (a, b) => b[1] - a[1],
      ),
    [rolesQuery.data?.metrics.byRole],
  );

  const saveRole = async (user: RoleUserRow) => {
    const pendingRole = pendingRoleByUser[user.userId] ?? user.role;
    if (pendingRole === user.role) {
      return;
    }

    setActionError(null);
    setSavingUserId(user.userId);

    try {
      const response = await fetch("/api/admin/roles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId: user.userId, role: pendingRole }),
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Could not update role.");
      }

      setPendingRoleByUser((current) => {
        const next = { ...current };
        delete next[user.userId];
        return next;
      });

      await queryClient.invalidateQueries({
        queryKey: ["admin-role-management"],
      });
      await queryClient.invalidateQueries({ queryKey: ["admin-users-roster"] });
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not update role.",
      );
    } finally {
      setSavingUserId(null);
    }
  };

  if (rolesQuery.isLoading) {
    return <p className="text-sm text-slate-300">Loading role management...</p>;
  }

  if (rolesQuery.isError) {
    return (
      <p className="text-sm text-red-300">
        {rolesQuery.error instanceof Error
          ? rolesQuery.error.message
          : "Could not load role management data."}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold text-white">Role Management</h2>
          <p className="mt-1 text-sm text-slate-200/85">
            Assign and adjust role mappings for authenticated users.
          </p>
        </div>
        <Badge>{rolesQuery.data?.metrics.total ?? 0} Users</Badge>
      </div>

      {actionError ? (
        <p className="rounded-lg border border-red-300/40 bg-red-500/10 px-3 py-2 text-xs text-red-100">
          {actionError}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Total Users">
          <p className="text-3xl font-semibold text-white">
            {rolesQuery.data?.metrics.total ?? 0}
          </p>
        </Card>
        <Card title="Roles Configured">
          <p className="text-3xl font-semibold text-white">{roleRows.length}</p>
        </Card>
        <Card title="Eligible Roles">
          <p className="text-3xl font-semibold text-white">
            {availableRoles.length}
          </p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.6fr_1.4fr]">
        <Card
          title="Role Distribution"
          description="How users are currently split across access levels."
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-200">
              <thead>
                <tr className="border-b border-white/15 text-xs uppercase tracking-[0.08em] text-slate-400">
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Users</th>
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
                      No role data.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>

        <Card
          title="User Role Assignments"
          description="Update a person's role, then save when you're ready."
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-200">
              <thead>
                <tr className="border-b border-white/15 text-xs uppercase tracking-[0.08em] text-slate-400">
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Organization</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const selectedRole =
                    pendingRoleByUser[user.userId] ?? user.role;
                  const hasChanges = selectedRole !== user.role;
                  const isSaving = savingUserId === user.userId;

                  return (
                    <tr key={user.userId} className="border-b border-white/10">
                      <td className="px-3 py-2">
                        <p>{user.fullName ?? "No name"}</p>
                        <p className="text-xs text-slate-400">{user.email}</p>
                      </td>
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
                        <SelectMenu
                          value={selectedRole}
                          onChange={(nextRole) =>
                            setPendingRoleByUser((current) => ({
                              ...current,
                              [user.userId]: nextRole,
                            }))
                          }
                          options={availableRoles.map((role) => ({
                            value: role,
                            label: role,
                          }))}
                          className="min-w-36"
                          buttonClassName="h-9"
                          disabled={Boolean(savingUserId)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Button
                          variant={hasChanges ? "primary" : "ghost"}
                          className="h-9 px-3 text-xs"
                          disabled={!hasChanges || Boolean(savingUserId)}
                          onClick={() => void saveRole(user)}
                        >
                          {isSaving ? "Saving..." : "Save"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
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
