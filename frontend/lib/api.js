const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

async function handle(res) {
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const j = await res.json();
      if (j.detail) {
        msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
      }
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

/**
 * Low-level post helper that talks to /api/analyze/... (forwarded by Next.js rewrite or direct)
 */
export async function post(path, body, isForm) {
  let res;
  try {
    const url = process.env.NEXT_PUBLIC_API_URL && !process.env.NEXT_PUBLIC_API_URL.includes("localhost:8000")
      ? `${process.env.NEXT_PUBLIC_API_URL}/analyze/${path}`
      : `/api/analyze/${path}`;

    res = await fetch(url, {
      method: "POST",
      headers: isForm ? {} : { "Content-Type": "application/json" },
      body: isForm ? body : JSON.stringify(body),
    });
  } catch (err) {
    throw new Error("Cannot reach the analysis server. Make sure the backend server is running.");
  }

  if (res.status >= 500) {
    let detail = "";
    try {
      const j = await res.json();
      if (j.detail) detail = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    } catch {}
    throw new Error(detail || "Backend analysis service error (500). Please check the server logs.");
  }

  return handle(res);
}

export function scanScreenshot(files, text) {
  const fd = new FormData();
  if (Array.isArray(files)) {
    files.forEach((f) => fd.append("files", f));
    if (files.length > 0) fd.append("file", files[0]);
  } else if (files) {
    fd.append("files", files);
    fd.append("file", files);
  }
  fd.append("text", text || "");
  return post("screenshot", fd, true);
}

export function scanInstagram({
  files,
  username,
  upi,
  phone,
  followers,
  likes,
  comments,
  comments_status,
  account_age_bucket,
  payment_terms_type,
}) {
  if (files && files.length > 0) {
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    fd.append("username", username || "");
    fd.append("upi", upi || "");
    fd.append("phone", phone || "");
    fd.append("manual_followers", followers || "");
    fd.append("manual_avg_likes", likes || "");
    fd.append("manual_avg_comments", comments || "");
    if (comments_status) fd.append("comments_status", comments_status);
    if (account_age_bucket) fd.append("account_age_bucket", account_age_bucket);
    if (payment_terms_type) fd.append("payment_terms_type", payment_terms_type);
    return post("instagram", fd, true);
  }

  const profile = {
    username: username ? username.trim().replace(/^@/, "") : undefined,
    upi: upi ? upi.trim() : undefined,
    phone: phone ? phone.trim() : undefined,
    followers: followers || undefined,
    avg_likes: likes || undefined,
    avg_comments: comments || undefined,
    comments_status: comments_status || undefined,
    account_age_bucket: account_age_bucket || undefined,
    payment_terms_type: payment_terms_type || undefined,
  };
  return post("instagram", { profile });
}

export function scanTelegram(text) {
  return post("telegram", { text: (text || "").trim(), message: (text || "").trim() });
}

export function scanText(text) {
  return post("text", { text: (text || "").trim() });
}

export function scanEmail(subject, body, sender) {
  return post("email", { subject: subject || "", body: (body || "").trim(), sender: (sender || "").trim() });
}

export async function sendReport(entity_type, value, category = "") {
  const url = process.env.NEXT_PUBLIC_API_URL && !process.env.NEXT_PUBLIC_API_URL.includes("localhost:8000")
    ? `${process.env.NEXT_PUBLIC_API_URL}/report`
    : `/api/report`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entity_type, value: (value || "").trim(), category }),
  });
  return handle(res);
}

export async function saveScanHistory(item) {
  const url = process.env.NEXT_PUBLIC_API_URL && !process.env.NEXT_PUBLIC_API_URL.includes("localhost:8000")
    ? `${process.env.NEXT_PUBLIC_API_URL}/history`
    : `/api/history`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
    return await handle(res);
  } catch (err) {
    console.warn("Failed to persist to backend history:", err);
    return { ok: false };
  }
}

export async function fetchScanHistory(userId) {
  const url = process.env.NEXT_PUBLIC_API_URL && !process.env.NEXT_PUBLIC_API_URL.includes("localhost:8000")
    ? `${process.env.NEXT_PUBLIC_API_URL}/history/${encodeURIComponent(userId)}`
    : `/api/history/${encodeURIComponent(userId)}`;

  try {
    const res = await fetch(url);
    return await handle(res);
  } catch (err) {
    console.warn("Failed to fetch backend history:", err);
    return { history: [] };
  }
}
