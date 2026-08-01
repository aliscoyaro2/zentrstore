import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import {
  User,
  Camera,
  Loader2,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Screen, PageHeader, Panel } from "@/components/zentra/shell";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/account/edit")({
  head: () => ({
    meta: [
      { title: "Edit Profile | Zentra" },
      { name: "description", content: "Update your profile information" },
    ],
  }),
  component: EditProfilePage,
});

function EditProfilePage() {
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">(
    "idle"
  );
  const [errorMessage, setErrorMessage] = useState("");

  // ── Fetch current profile ── (hooks must run unconditionally, before any early return)
  const profile = useQuery({
    queryKey: ["profile", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, phone, email")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // ── Update profile mutation ──
  const updateProfile = useMutation({
    mutationFn: async ({
      full_name,
      phone,
      photo_url,
    }: {
      full_name: string;
      phone: string;
      photo_url?: string | null;
    }) => {
      if (!user) throw new Error("Not signed in");
      const updates: any = { full_name, phone };
      if (photo_url !== undefined) {
        updates.photo_url = photo_url;
      }
      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
      setSaveStatus("success");
      setTimeout(() => {
        setSaveStatus("idle");
        navigate({ to: "/account" });
      }, 1500);
    },
    onError: (error: any) => {
      setSaveStatus("error");
      setErrorMessage(error.message || "Something went wrong");
      setTimeout(() => setSaveStatus("idle"), 3000);
    },
  });

  if (loading) {
    return (
      <Screen>
        <PageHeader title="Edit Profile" />
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

  // ── Upload photo to Supabase Storage ──
  const uploadPhoto = async (file: File): Promise<string | null> => {
    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `profiles/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    } catch (error) {
      console.error("Upload error:", error);
      setErrorMessage("Failed to upload photo");
      return null;
    } finally {
      setUploading(false);
    }
  };

  // ── Handle form submit ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim()) {
      setSaveStatus("error");
      setErrorMessage("Full name is required");
      setTimeout(() => setSaveStatus("idle"), 3000);
      return;
    }

    let photoUrl: string | null | undefined = undefined;

    // Upload photo if selected
    if (photoFile) {
      const uploadedUrl = await uploadPhoto(photoFile);
      if (uploadedUrl) {
        photoUrl = uploadedUrl;
      } else {
        // Upload failed, but we can still save other fields
        // Or we can abort – let's abort to avoid partial update
        return;
      }
    }

    updateProfile.mutate({
      full_name: fullName.trim(),
      phone: phone.trim(),
      ...(photoUrl !== undefined ? { photo_url: photoUrl } : {}),
    });
  };

  // ── Handle file selection ──
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setPhotoPreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // ── Loading state ──
  if (profile.isLoading) {
    return (
      <Screen>
        <PageHeader title="Edit Profile" />
        <div className="px-4 py-6">
          <Panel className="p-8 text-center">
            <div className="animate-pulse">Loading profile...</div>
          </Panel>
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      <PageHeader title="Edit Profile" />

      <div className="px-4 py-6 pb-24">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ── Photo Upload ── */}
          <div className="flex flex-col items-center">
            <div className="relative">
              <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-border">
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Profile preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User className="size-10 text-muted-foreground" />
                )}
              </div>
              <button
                type="button"
                onClick={triggerFileInput}
                className="absolute bottom-0 right-0 rounded-full bg-primary p-2 text-primary-foreground shadow-md hover:bg-primary/90 transition"
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Camera className="size-4" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Tap the camera to upload a photo
            </p>
          </div>

          {/* ── Full Name ── */}
          <div>
            <label className="text-sm font-medium">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          {/* ── Phone Number ── */}
          <div>
            <label className="text-sm font-medium">Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g., 08012345678"
              className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* ── Email (read-only) ── */}
          <div>
            <label className="text-sm font-medium">Email Address</label>
            <input
              type="email"
              value={profile.data?.email ?? user.email ?? ""}
              disabled
              className="mt-1 w-full rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Email cannot be changed here. Contact support if needed.
            </p>
          </div>

          {/* ── Status Messages ── */}
          {saveStatus === "success" && (
            <div className="flex items-center gap-2 rounded-xl bg-green-50 p-3 text-sm text-green-700">
              <CheckCircle className="size-5" />
              Profile updated successfully!
            </div>
          )}
          {saveStatus === "error" && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="size-5" />
              {errorMessage}
            </div>
          )}

          {/* ── Actions ── */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={updateProfile.isPending || uploading}
              className="flex-1 rounded-xl bg-primary py-3 font-bold text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50"
            >
              {updateProfile.isPending || uploading ? (
                <Loader2 className="mx-auto size-5 animate-spin" />
              ) : (
                "Save Changes"
              )}
            </button>
            <Link
              to="/account"
              className="flex items-center justify-center gap-2 rounded-xl border border-border px-6 py-3 font-medium hover:bg-muted/50 transition"
            >
              <ArrowLeft className="size-4" />
              Cancel
            </Link>
          </div>
        </form>
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
