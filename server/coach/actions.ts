import type { Signal } from "./signals.js";
import { firstName } from "./signals.js";

export interface ActionRecommendation {
  signal: Signal["kind"];
  title: string;
  body: string;
  leadId?: number;
  leadName?: string;
  channel: "sms" | "dm" | "share" | "self";
  rationale: string;
}

export function actionFor(signal: Signal): ActionRecommendation {
  switch (signal.kind) {
    case "high_intent":
      return {
        signal: signal.kind,
        title: `Call ${signal.lead ? firstName(signal.lead.name) : "your lead"} today`,
        body: `They've engaged recently. Don't email — pick up the phone or send a voice memo. People who reply are 6-8x more likely to take a meeting if you respond by call within 24 hours.`,
        leadId: signal.lead?.id,
        leadName: signal.lead?.name,
        channel: "sms",
        rationale: signal.reason,
      };
    case "follow_up_gap":
      return {
        signal: signal.kind,
        title: `Reach out to ${signal.lead ? firstName(signal.lead.name) : "your lead"}`,
        body: `They've gone cold. A short, specific message brings them back: reference what they told you, not what you want from them. 'Hey ${signal.lead ? firstName(signal.lead.name) : "[name]"} — thinking about what you said about [vision]…'`,
        leadId: signal.lead?.id,
        leadName: signal.lead?.name,
        channel: "dm",
        rationale: signal.reason,
      };
    case "fresh_lead":
      return {
        signal: signal.kind,
        title: `${signal.lead ? firstName(signal.lead.name) : "Your newest lead"} is hot — touch them now`,
        body: `They submitted in the last 24 hours. Speed is the moat. Even a 30-second text or voice memo right now puts you ahead of 95% of partners who wait for 'a good time'.`,
        leadId: signal.lead?.id,
        leadName: signal.lead?.name,
        channel: "sms",
        rationale: signal.reason,
      };
    case "activation_rescue":
      return {
        signal: signal.kind,
        title: "Send your funnel link to one person today",
        body: "Don't post it. Don't broadcast. Pick one specific person in your phone — by name — who'd respect a 5-minute video. Send it with one line: 'Curious what you think.' That's the whole move.",
        channel: "share",
        rationale: signal.reason,
      };
    default:
      return {
        signal: signal.kind,
        title: "One share, one DM, one follow-up",
        body: "Pick three names from your phone. Send one your funnel. DM one to check in (no agenda). Reply to one stale conversation. Daily three. That's the whole rhythm.",
        channel: "self",
        rationale: signal.reason,
      };
  }
}
