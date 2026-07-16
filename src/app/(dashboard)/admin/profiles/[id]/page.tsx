import type { Route } from "next";
import { redirect } from "next/navigation";

export default async function ProfileDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/admin/profiles/${id}/edit` as Route);
}
