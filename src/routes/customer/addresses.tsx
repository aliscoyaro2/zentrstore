import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MapPin,
  Plus,
  Trash2,
  Check,
  Edit,
  X,
  Home,
  Briefcase,
  Map,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Screen, PageHeader, Panel } from "@/components/zentra/shell";
import { useSession } from "@/hooks/use-session";
import { roleHome } from "@/lib/roles";
import { useState } from "react";

export const Route = createFileRoute("/customer/addresses")({
  head: () => ({
    meta: [
      { title: "My Addresses | Zentra" },
      {
        name: "description",
        content: "Manage your delivery addresses",
      },
    ],
  }),
  component: AddressesPage,
});

function AddressesPage() {
  const { user, loading, role, roleLoading } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    label: "",
    formatted: "",
    lat: 0,
    lng: 0,
  });

  // ── Fetch addresses ── (hooks must run unconditionally, before any early return)
  const addresses = useQuery({
    queryKey: ["addresses", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("addresses")
        .select("*")
        .eq("user_id", user!.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  // ── Add address ──
  const addAddress = useMutation({
    mutationFn: async (newAddress: {
      label: string;
      formatted: string;
      lat: number;
      lng: number;
    }) => {
      if (!user) throw new Error("Not signed in");
      // If this is the first address, make it default
      const existingAddresses = addresses.data || [];
      const isFirst = existingAddresses.length === 0;

      const { data, error } = await supabase.from("addresses").insert({
        user_id: user.id,
        label: newAddress.label || "Home",
        formatted: newAddress.formatted,
        lat: newAddress.lat,
        lng: newAddress.lng,
        is_default: isFirst, // First address becomes default
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["addresses", user?.id] });
      setShowForm(false);
      resetForm();
    },
    onError: (error) => {
      console.error("Error adding address:", error);
      alert("Could not save address. Please try again.");
    },
  });

  // ── Update address ──
  const updateAddress = useMutation({
    mutationFn: async ({
      id,
      label,
      formatted,
      lat,
      lng,
    }: {
      id: string;
      label: string;
      formatted: string;
      lat: number;
      lng: number;
    }) => {
      if (!user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("addresses")
        .update({ label, formatted, lat, lng })
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["addresses", user?.id] });
      setEditingId(null);
      resetForm();
    },
    onError: (error) => {
      console.error("Error updating address:", error);
      alert("Could not update address. Please try again.");
    },
  });

  // ── Set default address ──
  const setDefault = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Not signed in");
      // First, unset all addresses for this user
      await supabase
        .from("addresses")
        .update({ is_default: false })
        .eq("user_id", user.id);

      // Then set the selected one as default
      const { data, error } = await supabase
        .from("addresses")
        .update({ is_default: true })
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["addresses", user?.id] });
    },
  });

  // ── Delete address ──
  const deleteAddress = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("addresses")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["addresses", user?.id] });
    },
    onError: (error) => {
      console.error("Error deleting address:", error);
      alert("Could not delete address. Please try again.");
    },
  });

  // Still checking for an existing session — don't redirect yet
  if (loading) {
    return (
      <Screen>
        <PageHeader title="My Addresses" />
        <div className="px-4 py-6">
          <Panel className="p-8 text-center">
            <div className="animate-pulse">Loading...</div>
          </Panel>
        </div>
      </Screen>
    );
  }

  // Redirect if not logged in
  if (!user) {
    navigate({ to: "/login" });
    return null;
  }

  // Delivery addresses are a customer-only concept — merchants/riders belong
  // in their own dashboards.
  if (!roleLoading && role && role !== "customer") {
    navigate({ to: roleHome(role) });
    return null;
  }

  const resetForm = () => {
    setFormData({ label: "", formatted: "", lat: 0, lng: 0 });
  };

  const handleEdit = (address: any) => {
    setEditingId(address.id);
    setFormData({
      label: address.label || "",
      formatted: address.formatted || "",
      lat: address.lat || 0,
      lng: address.lng || 0,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.formatted.trim()) {
      alert("Please enter an address.");
      return;
    }

    // For now, use placeholder lat/lng (0,0) — in production, use Google Geocoding API
    const lat = formData.lat || 0;
    const lng = formData.lng || 0;

    if (editingId) {
      updateAddress.mutate({
        id: editingId,
        label: formData.label || "Home",
        formatted: formData.formatted,
        lat,
        lng,
      });
    } else {
      addAddress.mutate({
        label: formData.label || "Home",
        formatted: formData.formatted,
        lat,
        lng,
      });
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    resetForm();
  };

  const getLabelIcon = (label: string) => {
    const lower = label.toLowerCase();
    if (lower.includes("home")) return <Home className="size-4" />;
    if (lower.includes("office") || lower.includes("work")) return <Briefcase className="size-4" />;
    return <MapPin className="size-4" />;
  };

  // ── Loading state ──
  if (addresses.isLoading) {
    return (
      <Screen>
        <PageHeader title="My Addresses" />
        <div className="px-4 py-6">
          <Panel className="p-8 text-center">
            <div className="animate-pulse">Loading your addresses...</div>
          </Panel>
        </div>
      </Screen>
    );
  }

  const addressList = addresses.data || [];

  return (
    <Screen>
      <PageHeader
        title="My Addresses"
        subtitle="Save and manage your delivery addresses"
      />

      <div className="space-y-4 px-4 py-6 pb-24">
        {/* ── Add Address Button ── */}
        {!showForm && !editingId && (
          <button
            onClick={() => setShowForm(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 py-4 text-sm font-medium text-primary hover:bg-primary/10 transition"
          >
            <Plus className="size-5" />
            Add New Address
          </button>
        )}

        {/* ── Address Form ── */}
        {(showForm || editingId) && (
          <Panel className="p-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Address Label</label>
                <div className="mt-1 flex gap-2 flex-wrap">
                  {["Home", "Office", "Other"].map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, label }))
                      }
                      className={`px-3 py-1 text-xs rounded-full border ${
                        formData.label === label
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Address</label>
                <input
                  type="text"
                  value={formData.formatted}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      formatted: e.target.value,
                    }))
                  }
                  placeholder="e.g., 123 Baga Road, Maiduguri"
                  className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Enter a full address (map location will be added later)
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-primary py-3 font-bold text-primary-foreground hover:bg-primary/90 transition"
                  disabled={addAddress.isPending || updateAddress.isPending}
                >
                  {addAddress.isPending || updateAddress.isPending
                    ? "Saving..."
                    : editingId
                    ? "Update Address"
                    : "Save Address"}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-xl border border-border px-4 py-3 font-medium hover:bg-muted/50 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </Panel>
        )}

        {/* ── Address List ── */}
        {addressList.length === 0 && !showForm && !editingId && (
          <Panel className="p-8 text-center">
            <div className="flex flex-col items-center gap-2">
              <Map className="size-12 text-muted-foreground/30" />
              <p className="text-sm font-medium">No addresses saved</p>
              <p className="text-xs text-muted-foreground">
                Add your first delivery address above.
              </p>
            </div>
          </Panel>
        )}

        {addressList.map((address) => (
          <Panel
            key={address.id}
            className={`p-5 ${address.is_default ? "border-primary/30 bg-primary/5" : ""}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-muted-foreground">
                  {getLabelIcon(address.label || "Home")}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {address.label || "Home"}
                    </span>
                    {address.is_default && (
                      <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {address.formatted || "Address not set"}
                  </p>
                  {address.lat === 0 && address.lng === 0 && (
                    <p className="text-xs text-yellow-600 mt-1">
                      ⚠️ Map location not set — please update this address.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1">
                {/* Edit button */}
                <button
                  onClick={() => handleEdit(address)}
                  className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition"
                  aria-label="Edit address"
                >
                  <Edit className="size-4" />
                </button>

                {/* Set default button (only if not already default) */}
                {!address.is_default && (
                  <button
                    onClick={() => setDefault.mutate(address.id)}
                    className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-primary transition"
                    aria-label="Set as default"
                    disabled={setDefault.isPending}
                  >
                    <Check className="size-4" />
                  </button>
                )}

                {/* Delete button */}
                <button
                  onClick={() => {
                    if (window.confirm("Delete this address?")) {
                      deleteAddress.mutate(address.id);
                    }
                  }}
                  className="p-2 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition"
                  aria-label="Delete address"
                  disabled={deleteAddress.isPending}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          </Panel>
        ))}
      </div>

      {/* ── Bottom Navigation ── */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-card py-2 px-4 flex justify-around max-w-md mx-auto">
        <Link
          to="/"
          className="text-center text-sm text-muted-foreground hover:text-primary transition"
        >
          Explore
        </Link>
        <Link
          to="/orders"
          className="text-center text-sm text-muted-foreground hover:text-primary transition"
        >
          Orders
        </Link>
        <Link
          to="/cart"
          className="text-center text-sm text-muted-foreground hover:text-primary transition"
        >
          Cart
        </Link>
        <Link
          to="/account"
          className="text-center text-sm text-primary font-medium"
        >
          Profile
        </Link>
      </div>
    </Screen>
  );
}
