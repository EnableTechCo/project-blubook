"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SelectMenu } from "@/components/ui/select-menu";

type PartnerRow = {
  id: string;
  packageStream: string;
  name: string;
  site: string;
};

function normalizeSite(site: string) {
  if (/^https?:\/\//i.test(site)) {
    return site;
  }
  return `https://${site}`;
}

export default function AdminPartnersPage() {
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [streams, setStreams] = useState<string[]>([]);
  const [newStream, setNewStream] = useState("");
  const [newName, setNewName] = useState("");
  const [newSite, setNewSite] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingStream, setEditingStream] = useState("");
  const [editingName, setEditingName] = useState("");
  const [editingSite, setEditingSite] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<PartnerRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPartners = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/service-partners", {
        credentials: "include",
      });
      const body = (await response.json()) as {
        error?: string;
        streams?: string[];
        partners?: PartnerRow[];
      };

      if (!response.ok) {
        throw new Error(body.error ?? "Could not load partners.");
      }

      const nextStreams = body.streams ?? [];
      setStreams(nextStreams);
      setPartners(body.partners ?? []);
      setNewStream((current) => current || nextStreams[0] || "");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load partners.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPartners();
  }, []);

  const addPartner = async () => {
    if (!newStream.trim() || !newName.trim() || !newSite.trim() || isSaving) {
      return false;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/service-partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          packageStream: newStream,
          name: newName.trim(),
          site: newSite.trim(),
        }),
      });

      const body = (await response.json()) as {
        error?: string;
        partner?: PartnerRow;
      };

      if (!response.ok || !body.partner) {
        throw new Error(body.error ?? "Could not create partner.");
      }

      setPartners((current) => [body.partner as PartnerRow, ...current]);
      setNewName("");
      setNewSite("");
      return true;
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Could not create partner.",
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (partner: PartnerRow) => {
    setEditingId(partner.id);
    setEditingStream(partner.packageStream);
    setEditingName(partner.name);
    setEditingSite(partner.site);
    setIsEditModalOpen(true);
  };

  const saveEdit = async () => {
    if (!editingId || !editingName.trim() || !editingSite.trim() || isSaving) {
      return false;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/service-partners/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          packageStream: editingStream,
          name: editingName.trim(),
          site: editingSite.trim(),
        }),
      });

      const body = (await response.json()) as {
        error?: string;
        partner?: {
          id: string;
          name: string;
          site: string;
          packageStream: string;
        };
      };

      if (!response.ok || !body.partner) {
        throw new Error(body.error ?? "Could not update partner.");
      }

      setPartners((current) =>
        current.map((partner) =>
          partner.id === editingId
            ? {
                ...partner,
                packageStream:
                  body.partner?.packageStream ?? partner.packageStream,
                name: body.partner?.name ?? partner.name,
                site: body.partner?.site ?? partner.site,
              }
            : partner,
        ),
      );
      setEditingId(null);
      setEditingStream("");
      setEditingName("");
      setEditingSite("");
      setIsEditModalOpen(false);
      return true;
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Could not update partner.",
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const removePartner = async (id: string) => {
    if (isSaving) return;
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/service-partners/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const body = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(body.error ?? "Could not remove partner.");
      }

      setPartners((current) => current.filter((partner) => partner.id !== id));
      setDeleteTarget(null);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not remove partner.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const streamOptions = useMemo(
    () => streams.map((stream) => ({ value: stream, label: stream })),
    [streams],
  );

  const partnersByStream = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of partners) {
      map[p.packageStream] = (map[p.packageStream] ?? 0) + 1;
    }
    return map;
  }, [partners]);

  const coverageGaps = useMemo(
    () => streams.filter((s) => !partnersByStream[s]),
    [streams, partnersByStream],
  );

  const singleCoverage = useMemo(
    () => streams.filter((s) => partnersByStream[s] === 1),
    [streams, partnersByStream],
  );

  const redundantStreams = useMemo(
    () => streams.filter((s) => (partnersByStream[s] ?? 0) >= 2),
    [streams, partnersByStream],
  );

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading partners...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold text-slate-900">
            Service Partners
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Every registered logistics and fulfilment partner — who they are,
            which service streams they cover, and how to reach them.
          </p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>Add Partner</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Unassigned Streams">
          <p
            className={`text-3xl font-semibold ${coverageGaps.length > 0 ? "text-red-600" : "text-emerald-600"}`}
          >
            {coverageGaps.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {coverageGaps.length === 0
              ? "All streams have at least one partner"
              : `No partner assigned — orders on ${coverageGaps.slice(0, 2).join(", ")}${coverageGaps.length > 2 ? ` +${coverageGaps.length - 2} more` : ""} will stall`}
          </p>
        </Card>
        <Card title="Single-Partner Streams">
          <p
            className={`text-3xl font-semibold ${singleCoverage.length > 0 ? "text-amber-600" : "text-emerald-600"}`}
          >
            {singleCoverage.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {singleCoverage.length === 0
              ? "No single points of failure"
              : `One partner each — no fallback if ${singleCoverage.slice(0, 2).join(", ")}${singleCoverage.length > 2 ? ` +${singleCoverage.length - 2} more` : ""} goes down`}
          </p>
        </Card>
        <Card title="Redundant Streams">
          <p
            className={`text-3xl font-semibold ${redundantStreams.length === streams.length && streams.length > 0 ? "text-emerald-600" : "text-slate-900"}`}
          >
            {redundantStreams.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {redundantStreams.length === 0
              ? "No stream has a backup partner yet"
              : `${redundantStreams.length} of ${streams.length} streams have 2+ partners and can failover`}
          </p>
        </Card>
      </div>

      <Card
        title="Partner Registry"
        description="Every registered partner and which service type they're set up to handle."
      >
        {error ? (
          <p className="mb-3 rounded-lg border border-red-300/40 bg-red-500/10 px-3 py-2 text-xs text-red-100">
            {error}
          </p>
        ) : null}
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500">
                <th className="px-3 py-2">Stream</th>
                <th className="px-3 py-2">Partner</th>
                <th className="px-3 py-2">Site</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((partner) => (
                <tr
                  key={partner.id}
                  className="border-b border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-3 py-2 text-slate-700">
                    {partner.packageStream}
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-900">
                    {partner.name}
                  </td>
                  <td className="px-3 py-2">
                    <a
                      href={normalizeSite(partner.site)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan-700 hover:text-cyan-800"
                    >
                      {partner.site}
                    </a>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="ghost"
                        onClick={() => startEdit(partner)}
                        disabled={isSaving}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setDeleteTarget(partner)}
                        disabled={isSaving}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {partners.length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-slate-400" colSpan={4}>
                    No partners found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      {isCreateModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Add partner"
          onClick={() => {
            if (!isSaving) {
              setIsCreateModalOpen(false);
            }
          }}
        >
          <div
            className="surface w-full max-w-xl rounded-2xl border border-white/20 p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-2xl font-semibold text-white">Add Partner</h3>
            <p className="mt-1 text-sm text-slate-200">
              Create a new partner and map it to a package stream.
            </p>

            <div className="mt-4 grid gap-3">
              <label className="text-xs text-slate-300">
                Stream
                <SelectMenu
                  className="mt-1"
                  value={newStream}
                  onChange={(value) => setNewStream(value)}
                  options={streamOptions}
                  disabled={isSaving || streamOptions.length === 0}
                />
              </label>
              <label className="text-xs text-slate-300">
                Partner Name
                <input
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-white/20 bg-white/5 px-3 text-sm text-white"
                  placeholder="Partner name"
                />
              </label>
              <label className="text-xs text-slate-300">
                Site
                <input
                  value={newSite}
                  onChange={(event) => setNewSite(event.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-white/20 bg-white/5 px-3 text-sm text-white"
                  placeholder="www.example.com"
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setIsCreateModalOpen(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  void addPartner().then((created) => {
                    if (created) {
                      setIsCreateModalOpen(false);
                    }
                  });
                }}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Create Partner"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {isEditModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Edit partner"
          onClick={() => {
            if (!isSaving) {
              setIsEditModalOpen(false);
            }
          }}
        >
          <div
            className="surface w-full max-w-xl rounded-2xl border border-white/20 p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-2xl font-semibold text-white">Edit Partner</h3>
            <p className="mt-1 text-sm text-slate-200">
              Update partner stream mapping and metadata.
            </p>

            <div className="mt-4 grid gap-3">
              <label className="text-xs text-slate-300">
                Stream
                <SelectMenu
                  className="mt-1"
                  value={editingStream}
                  onChange={(value) => setEditingStream(value)}
                  options={streamOptions}
                  disabled={isSaving || streamOptions.length === 0}
                />
              </label>
              <label className="text-xs text-slate-300">
                Partner Name
                <input
                  value={editingName}
                  onChange={(event) => setEditingName(event.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-white/20 bg-white/5 px-3 text-sm text-white"
                  placeholder="Partner name"
                />
              </label>
              <label className="text-xs text-slate-300">
                Site
                <input
                  value={editingSite}
                  onChange={(event) => setEditingSite(event.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-white/20 bg-white/5 px-3 text-sm text-white"
                  placeholder="www.example.com"
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingId(null);
                  setEditingStream("");
                  setEditingName("");
                  setEditingSite("");
                }}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  void saveEdit();
                }}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        ariaLabel="Delete partner confirmation"
        title="Delete Partner"
        description={`Are you sure you want to delete ${deleteTarget?.name ?? "this partner"}?`}
        warning="This partner will no longer be available for order routing."
        confirmLabel="Delete"
        busy={isSaving}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          void removePartner(deleteTarget.id);
        }}
      />
    </div>
  );
}
