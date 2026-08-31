import { AlertTriangle, Info, XCircle } from "lucide-react";

type ErrorMessageProps = {
  title?: string;
  message: string;
  tone?: "error" | "warning" | "info";
};

export function ErrorMessage({
  message,
  title,
  tone = "error",
}: ErrorMessageProps) {
  const Icon = tone === "error" ? XCircle : tone === "warning" ? AlertTriangle : Info;

  return (
    <div className={`notice notice-${tone}`}>
      <Icon aria-hidden="true" size={18} />
      <div>
        {title ? <strong>{title}</strong> : null}
        <p>{message}</p>
      </div>
    </div>
  );
}
