import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { forwardRef, useEffect, useState, type ComponentPropsWithoutRef, type ElementRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogPortal = DialogPrimitive.Portal;

/**
 * Tracks window.visualViewport.height so a fixed-position modal can size
 * itself to the actually-visible area (which shrinks when the iOS keyboard
 * opens). 100dvh doesn't shrink for the on-screen keyboard on iOS Safari,
 * so without this any modal containing a form inputs the keyboard would
 * just hide the bottom of the modal with no way to scroll into it.
 *
 * Returns null while server-rendering or in browsers without visualViewport
 * support, in which case the caller falls back to the CSS dvh max-height.
 */
function useVisualViewportHeight(): number | null {
  const [h, setH] = useState<number | null>(null);
  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    const update = () => setH(vv.height);
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return h;
}

export const DialogOverlay = forwardRef<
  ElementRef<typeof DialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    style={{ background: "color-mix(in oklab, var(--surface-0) 78%, transparent)" }}
    {...props}
  />
));
DialogOverlay.displayName = "DialogOverlay";

export const DialogContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { hideClose?: boolean }
>(({ className, children, hideClose, style, ...props }, ref) => {
  const vvh = useVisualViewportHeight();
  // When the iOS keyboard opens, visualViewport.height shrinks to the
  // actually-visible area. Use that as the modal's max-height so the
  // overflow-y-auto inside actually has somewhere to scroll into. Fall back
  // to the CSS dvh value if visualViewport isn't available.
  const measuredStyle = vvh !== null ? { ...style, maxHeight: `${vvh - 32}px` } : style;
  return (
    <DialogPortal>
      <DialogOverlay />
      {/* Outer wrapper handles centering + safe-area insets. The actual
          scrollable surface is the Content itself (max-h + overflow-y-auto),
          not this wrapper. Wrapper-level scroll fights Radix's pointer
          handlers on iOS Safari and silently fails to respond to touch
          drags. Content-level scroll is what iOS expects on a fixed modal
          and works without any extra touch-action coaching. */}
      <div className="fixed inset-0 z-50 pointer-events-none">
        <div className="flex min-h-full items-start sm:items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
          <DialogPrimitive.Content
            ref={ref}
            style={measuredStyle}
            className={cn(
              "pointer-events-auto relative w-full max-w-lg my-auto",
              "max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain",
              "bfa-card-strong p-6 sm:p-8",
              "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
              className,
            )}
            {...props}
          >
            {children}
            {!hideClose && (
              <DialogPrimitive.Close
                className="absolute right-3.5 top-3.5 rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-[rgb(var(--overlay-rgb)/0.06)] transition"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </DialogPrimitive.Close>
            )}
          </DialogPrimitive.Content>
        </div>
      </div>
    </DialogPortal>
  );
});
DialogContent.displayName = "DialogContent";

export function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-1.5 text-left", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3", className)}
      {...props}
    />
  );
}

export const DialogTitle = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("font-display text-[22px] sm:text-[26px] font-bold leading-tight tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = "DialogTitle";

export const DialogDescription = forwardRef<
  ElementRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground leading-relaxed", className)}
    {...props}
  />
));
DialogDescription.displayName = "DialogDescription";
