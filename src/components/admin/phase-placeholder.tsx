import { Construction } from "lucide-react";

export function PhasePlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <>
      <div className="page-header">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </div>
      <div className="phase-notice">
        <Construction size={20} aria-hidden="true" />
        <div>
          <strong>Foundation ready</strong>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            Route, authentication, navigation, and authorization are active. Feature delivery follows its planned phase.
          </p>
        </div>
      </div>
    </>
  );
}
