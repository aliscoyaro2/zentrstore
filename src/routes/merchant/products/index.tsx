import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MerchantLayout } from "@/components/zentra/merchant-layout";
import { naira } from "@/lib/money";
import { useMerchantPermissions } from "@/hooks/use-merchant-permissions";

export const Route = createFileRoute("/merchant/products/")({
  head: () => ({
    meta: [
      { title: "Products – Merchant" },
      { name: "description", content: "Manage your product catalogue." },
    ],
  }),
  component: MerchantProductsPage,
});

function MerchantProductsPage() {
  const { storeId, permissions, isLoading: permsLoading } = useMerchantPermissions();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");

  // All hooks must run unconditionally, on every render, in the same
  // order — never place a hook call after an early `return`. We gate
  // the query itself with `enabled` and gate what we *render* below.
  const products = useQuery({
    queryKey: ["merchant-products", storeId],
    enabled: Boolean(storeId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, description, price_kobo, category, is_available")
        .eq("merchant_id", storeId!)
        .order("category", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  if (permsLoading) return <MerchantLayout>Loading...</MerchantLayout>;
  if (!storeId) return <MerchantLayout>No store found.</MerchantLayout>;

  const canManageProducts = permissions?.products === "full";
  if (!canManageProducts) {
    return <MerchantLayout><p>You don't have permission to manage products.</p></MerchantLayout>;
  }

  async function addProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !price) return;
    const { error } = await supabase.from("products").insert({
      merchant_id: storeId,
      name: name.trim(),
      price_kobo: Math.round(Number(price) * 100),
      category: category.trim() || "General",
      description: description.trim() || null,
    });
    if (error) {
      toast.error("Could not add product", { description: error.message });
      return;
    }
    toast.success("Product added");
    setName("");
    setPrice("");
    setCategory("");
    setDescription("");
    setShowForm(false);
    queryClient.invalidateQueries({ queryKey: ["merchant-products", storeId] });
  }

  async function toggleAvailability(id: string, current: boolean) {
    const { error } = await supabase
      .from("products")
      .update({ is_available: !current })
      .eq("id", id);
    if (error) {
      toast.error("Update failed", { description: error.message });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["merchant-products", storeId] });
  }

  async function deleteProduct(id: string) {
    if (!window.confirm("Delete this product?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      toast.error("Could not delete", { description: error.message });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["merchant-products", storeId] });
  }

  const productList = products.data ?? [];

  return (
    <MerchantLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Catalogue</h2>
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
          >
            <Plus className="size-4" />
            Add product
          </button>
        </div>

        {showForm && (
          <form onSubmit={addProduct} className="rounded-xl border border-border p-4 space-y-3 bg-card">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Product name"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              required
            />
            <input
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder="Price in ₦"
              type="number"
              step="0.01"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              required
            />
            <input
              value={category}
              onChange={e => setCategory(e.target.value)}
              placeholder="Category (e.g. Main dishes)"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button type="submit" className="flex-1 rounded-lg bg-primary py-2 text-sm font-bold text-primary-foreground">
                Save
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-border px-4 py-2 text-sm">
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="space-y-2">
          {productList.length === 0 ? (
            <p className="text-sm text-muted-foreground">No products yet.</p>
          ) : (
            productList.map(p => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-border p-3 bg-card">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.category || "General"} · {naira(p.price_kobo)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleAvailability(p.id, p.is_available ?? true)}
                    className="text-sm text-muted-foreground"
                  >
                    {p.is_available ? (
                      <ToggleRight className="size-5 text-success" />
                    ) : (
                      <ToggleLeft className="size-5 text-muted-foreground" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteProduct(p.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </MerchantLayout>
  );
}
