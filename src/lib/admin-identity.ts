import type { Profile } from "@/lib/types";

export const primaryAdminEmail = "tiagov.bento@gmail.com";

export function isPrimaryAdminEmail(email?: string | null) {
  return email?.trim().toLowerCase() === primaryAdminEmail;
}

export function isPrimaryAdminProfile(profile?: Pick<Profile, "email"> | null) {
  return isPrimaryAdminEmail(profile?.email);
}
