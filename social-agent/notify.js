export async function notify(message, title = 'Budget365 Social Agent') {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) {
    console.log(`[notify] NTFY_TOPIC not set — skipping push: ${message}`);
    return;
  }
  try {
    const safeTitle = title.replace(/[^\x00-\x7F]/g, '');
    await fetch(`https://ntfy.sh/${topic}`, {
      method: 'POST',
      body: new TextEncoder().encode(message),
      headers: { Title: safeTitle, Priority: 'default', 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (err) {
    console.error(`[notify] Push failed: ${err.message}`);
  }
}
