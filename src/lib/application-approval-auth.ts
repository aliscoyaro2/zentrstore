import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Get-or-invite a user by email, for use at merchant/rider application
 * approval time.
 *
 * Context: applicants verify their email via OTP before filling out their
 * application (`signInWithOtp({ shouldCreateUser: true })`). That call
 * creates a real `auth.users` row immediately, even though the session it
 * produces is discarded right away and the applicant is never logged in.
 * So by the time an admin clicks Approve, `inviteUserByEmail` — which is
 * only meant for brand-new users — fails with "already registered".
 *
 * This helper checks for that existing (unconfirmed, passwordless) user
 * first and reuses it, only falling back to a real invite if one doesn't
 * exist (e.g. legacy applications from before this fix). Either path ends
 * with the applicant receiving a "set your password" email, so the
 * downstream experience is identical.
 */
export async function getOrInviteUser(
  supabaseAdmin: SupabaseClient,
  email: string,
  userMetadata: Record<string, unknown>,
  redirectTo: string,
): Promise<string> {
  const { data: existingList, error: listError } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1,
    // @ts-expect-error -- supabase-js's admin listUsers types don't declare the `email` filter param yet, but the Auth admin API supports it.
    email,
  });
  if (listError) throw new Error(listError.message);

  const existingUser = existingList?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (existingUser) {
    const { error: updateMetaError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
      user_metadata: { ...existingUser.user_metadata, ...userMetadata },
    });
    if (updateMetaError) throw new Error(updateMetaError.message);

    // inviteUserByEmail can't be reused on an existing user, and
    // generateLink() alone mints a link but never emails it (only
    // Supabase's own auth-email methods trigger the project's SMTP/Brevo
    // send). resetPasswordForEmail is the one "existing user" method that
    // both sends the email *and* lands on redirectTo with a temporary
    // session — functionally identical to the invite flow from the
    // applicant's side: they get an email, click it, and land on
    // /auth/set-password to choose their real password.
    const { error: sendError } = await supabaseAdmin.auth.resetPasswordForEmail(email, { redirectTo });
    // Best-effort: don't fail approval over the notification email — the
    // applicant/admin can always trigger "forgot password" from /login.
    if (sendError) {
      console.error("Could not send set-password link to existing user:", sendError.message);
    }

    return existingUser.id;
  }

  const { data: invited, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: userMetadata,
    redirectTo,
  });
  if (inviteError || !invited.user) {
    throw new Error(inviteError?.message ?? "Could not create the account.");
  }
  return invited.user.id;
}
