export function StatusBadge({
  active,
  activeLabel = "Active",
  inactiveLabel = "Inactive",
}: {
  active: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
}) {
  return (
    <span className={`status-badge ${active ? "is-active" : "is-inactive"}`}>
      <span aria-hidden="true" />
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}
