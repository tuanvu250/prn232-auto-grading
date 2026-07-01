interface ResubmissionDiscordPayload {
  action: "new" | "updated";
  studentId: string;
  email: string;
  name?: string;
  className?: string;
  labId: string;
  driveLink: string;
  note?: string;
}

export async function notifyDiscordResubmission(payload: ResubmissionDiscordPayload) {
  const webhookUrl = process.env.DISCORD_RESUBMIT_WEBHOOK_URL;
  if (!webhookUrl) return;

  const title = payload.action === "new" ? "New resubmit request" : "Updated resubmit link";
  const content = [
    `**${title}**`,
    `Student: ${payload.studentId} - ${payload.name || payload.email}`,
    `Email: ${payload.email}`,
    `Class: ${payload.className || "N/A"}`,
    `Lab: ${payload.labId}`,
    `Drive: ${payload.driveLink}`,
    payload.note ? `Note: ${payload.note}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    if (!res.ok) {
      console.error("Discord resubmission webhook failed:", res.status, await res.text());
    }
  } catch (err) {
    console.error("Discord resubmission webhook error:", err);
  }
}
