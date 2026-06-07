import { useState } from "react";
import { Check, Copy, Mail, MessageCircle, Phone } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { COLOR_META, renderScript, type ColorCode } from "@shared/colorCode";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  color: ColorCode;
  leadFirstName: string;
  partnerFirstName: string;
}

// Opens from the "How to talk to this color" button on lead-detail.tsx.
// One page, three blocks (Text, Email, Phone) with copy-to-clipboard for
// each. Scripts are first-person partner voice, plain text, no banned
// phrases, no earnings claims. {firstName} substitution happens here so the
// copy paste is ready to send as-is.
export function ColorScriptsModal({ open, onOpenChange, color, leadFirstName, partnerFirstName }: Props) {
  const meta = COLOR_META[color];
  const vars = { firstName: leadFirstName, partnerFirstName };

  if (!meta) return null;

  const textScript = renderScript(meta.scripts.text, vars);
  const emailSubject = renderScript(meta.scripts.email.subject, vars);
  const emailBody = renderScript(meta.scripts.email.body, vars);
  const callScript = renderScript(meta.scripts.call, vars);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2.5 mb-1">
            <span
              className="h-3 w-3 rounded-full shrink-0"
              style={{ backgroundColor: meta.hex, boxShadow: `0 0 0 4px ${meta.hex}22` }}
            />
            <p
              className="text-xs font-bold uppercase tracking-[0.18em]"
              style={{ color: meta.hex }}
            >
              {meta.label}
            </p>
          </div>
          <DialogTitle>How to talk to {leadFirstName}</DialogTitle>
          <DialogDescription>
            Scripts in your voice for the three channels. Tap copy and send.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-5 space-y-4">
          {/* Quick frame: lead with / avoid */}
          <div className="grid sm:grid-cols-2 gap-3">
            <FrameCard
              hex={meta.hex}
              label="Lead with"
              body={meta.scripts.leadWith}
            />
            <FrameCard
              hex={meta.hex}
              label="Avoid"
              body={meta.scripts.avoid}
            />
          </div>

          <ScriptBlock
            icon={MessageCircle}
            label="Text message"
            hex={meta.hex}
            content={textScript}
            copyValue={textScript}
          />

          <ScriptBlock
            icon={Mail}
            label="Email"
            hex={meta.hex}
            subject={emailSubject}
            content={emailBody}
            copyValue={`Subject: ${emailSubject}\n\n${emailBody}`}
          />

          <ScriptBlock
            icon={Phone}
            label="First 30 seconds on the call"
            hex={meta.hex}
            content={callScript}
            copyValue={callScript}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FrameCard({ hex, label, body }: { hex: string; label: string; body: string }) {
  return (
    <div
      className="rounded-xl p-3.5"
      style={{
        backgroundColor: `${hex}14`,
        boxShadow: `inset 0 0 0 1px ${hex}55`,
      }}
    >
      <p
        className="text-[10px] font-bold uppercase tracking-[0.18em] mb-1.5"
        style={{ color: hex }}
      >
        {label}
      </p>
      <p className="text-sm leading-relaxed text-foreground/90">{body}</p>
    </div>
  );
}

interface ScriptBlockProps {
  icon: typeof MessageCircle;
  label: string;
  hex: string;
  subject?: string;
  content: string;
  copyValue: string;
}

function ScriptBlock({ icon: Icon, label, hex, subject, content, copyValue }: ScriptBlockProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(copyValue);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked, no-op — the textarea is still selectable */
    }
  }

  return (
    <div className="bfa-card p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="inline-flex items-center gap-2">
          <Icon className="h-4 w-4" style={{ color: hex }} />
          <p className="font-semibold text-sm">{label}</p>
        </div>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-secondary/60 hover:bg-secondary text-foreground transition"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-[var(--gold)]" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" /> Copy
            </>
          )}
        </button>
      </div>
      {subject && (
        <p className="text-xs uppercase tracking-[0.16em] text-foreground/60 mb-2">
          Subject: <span className="text-foreground font-semibold normal-case tracking-normal">{subject}</span>
        </p>
      )}
      <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">{content}</p>
    </div>
  );
}
