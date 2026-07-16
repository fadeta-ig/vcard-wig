import type { ProfileStatusValue } from "@/lib/profile-options";

export function ProfileStatusBadge({
  status,
  label,
}: {
  status: ProfileStatusValue;
  label: string;
}) {
  return <span className={`profile-status profile-status-${status.toLowerCase()}`}>{label}</span>;
}
