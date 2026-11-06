"use client";

import { useId, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string };

export function PasswordField({ label, id, disabled, ...props }: PasswordFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);

  return <div className="password-field">
    <label htmlFor={inputId}>{label}</label>
    <div className="password-control">
      <input {...props} id={inputId} disabled={disabled} type={visible ? "text" : "password"} />
      <button type="button" disabled={disabled} aria-controls={inputId} aria-pressed={visible}
        aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
        onClick={() => setVisible(current => !current)}>
        {visible ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
        <span>{visible ? "Hide" : "Show"}</span>
      </button>
    </div>
  </div>;
}
