"use client";

import { PhaseWorkspace } from "@/features/operations/phase-workspace";
import {
  MOCK_ADMIN_USER_STREAMS,
  buildMockAdminUserMetrics,
  MOCK_USERS,
} from "@/features/mock/dashboard-data";
import { useState } from "react";
import type { MockUser, MockUserRole } from "@/features/mock/types";

export default function AdminUsersPage() {
  const metrics = buildMockAdminUserMetrics();

  const [users, setUsers] = useState<MockUser[]>(MOCK_USERS);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<MockUser | null>(null);

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    department: "",
    role: "customer" as MockUserRole,
  });

  const handleRoleChange = (id: string, newRole: MockUserRole) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id ? { ...u, role: newRole } : u
      )
    );
  };

  const createUser = () => {
    if (!form.fullName || !form.email) return;

    const newUser: MockUser = {
      id: `USR-${Date.now()}`,
      fullName: form.fullName,
      email: form.email,
      department: form.department,
      role: form.role,
      status: "active",
      lastSeenAt: new Date().toISOString(),
    };

    setUsers((prev) => [...prev, newUser]);

    setForm({
      fullName: "",
      email: "",
      department: "",
      role: "customer",
    });

    setShowAddModal(false);
  };

  const deleteUser = (id: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
  };

  const startEdit = (user: MockUser) => {
    setEditingUser(user);
  };

  const saveEdit = () => {
    if (!editingUser) return;

    setUsers((prev) =>
      prev.map((u) =>
        u.id === editingUser.id ? editingUser : u
      )
    );

    setEditingUser(null);
  };

  return (
    <div>
      <PhaseWorkspace
        phase="Phase 4"
        title="User Management"
        subtitle="Manage user lifecycle, onboarding status and department assignments."
        metrics={metrics}
        streams={MOCK_ADMIN_USER_STREAMS}
      />

      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div></div>

          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98]"
          >
            + Add User
          </button>
        </div>

        {/* Search */}
        {/* <div className="relative">
          <input
            placeholder="Search users by name, email, or role..."
            style={{ color: "black" }}
            className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div> */}

        {/* Table Card (UNCHANGED) */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 bg-white">
                {users.map((u) => (
                  <tr key={u.id} className="transition hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {u.fullName}
                    </td>

                    <td className="px-6 py-4 text-gray-600">
                      {u.email}
                    </td>

                    {/* <td className="px-6 py-4">
                      <select
                        value={u.role}
                        onChange={(e) =>
                          handleRoleChange(
                            u.id,
                            e.target.value as MockUserRole
                          )
                        }
                        className="rounded-md border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      >
                        <option value="admin">Admin</option>
                        <option value="staff">Staff</option>
                        <option value="partner">Partner</option>
                        <option value="customer">Customer</option>
                      </select>
                    </td> */}

                    <td className="px-6 py-4 text-gray-600 capitalize">
                      {u.role}
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => startEdit(u)}
                          className="text-sm font-medium text-blue-600 hover:text-blue-800"
                        >
                          Edit
                        </button>

                        <button
                          onClick={() => deleteUser(u.id)}
                          className="text-sm font-medium text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ADD MODAL (NOW INCLUDES ROLE FIELD) */}
        {showAddModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-md rounded-xl bg-white p-6">
              <h3 className="mb-4 text-lg font-semibold">
                Create User
              </h3>

              <div className="space-y-3">
                <input
                  placeholder="Full Name"
                  value={form.fullName}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      fullName: e.target.value,
                    }))
                  }
                  className="w-full rounded border p-2 text-black"
                />

                <input
                  placeholder="Email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      email: e.target.value,
                    }))
                  }
                  className="w-full rounded border p-2 text-black"
                />

                <input
                  placeholder="Department"
                  value={form.department}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      department: e.target.value,
                    }))
                  }
                  className="w-full rounded border p-2 text-black"
                />

                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      role: e.target.value as MockUserRole,
                    }))
                  }
                  className="w-full rounded border p-2 text-black"
                >
                  <option value="admin">Admin</option>
                  <option value="staff">Staff</option>
                  <option value="partner">Partner</option>
                  <option value="customer">Customer</option>
                </select>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="rounded border px-4 py-2 text-black"
                >
                  Cancel
                </button>

                <button
                  onClick={createUser}
                  className="rounded bg-blue-600 px-4 py-2 text-white"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {/* EDIT MODAL */}
        {editingUser && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-md rounded-xl bg-white p-6">
              <h3 className="mb-4 text-lg font-semibold">
                Edit User
              </h3>

              <div className="space-y-3">
                <input
                  value={editingUser.fullName}
                  onChange={(e) =>
                    setEditingUser({
                      ...editingUser,
                      fullName: e.target.value,
                    })
                  }
                  className="w-full rounded border p-2 text-black"
                />

                <input
                  value={editingUser.email}
                  onChange={(e) =>
                    setEditingUser({
                      ...editingUser,
                      email: e.target.value,
                    })
                  }
                  className="w-full rounded border p-2 text-black"
                />

                <input
                  value={editingUser.department || ""}
                  onChange={(e) =>
                    setEditingUser({
                      ...editingUser,
                      department: e.target.value,
                    })
                  }
                  className="w-full rounded border p-2 text-black"
                />

                <select
                  value={editingUser.role}
                  onChange={(e) =>
                    setEditingUser({
                      ...editingUser,
                      role: e.target.value as MockUserRole,
                    })
                  }
                  className="w-full rounded border p-2 text-black"
                >
                  <option value="admin">Admin</option>
                  <option value="staff">Staff</option>
                  <option value="partner">Partner</option>
                  <option value="customer">Customer</option>
                </select>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={() => setEditingUser(null)}
                  className="rounded border px-4 py-2 text-black"
                >
                  Cancel
                </button>

                <button
                  onClick={saveEdit}
                  className="rounded bg-blue-600 px-4 py-2 text-white"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}