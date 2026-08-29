import fs from "fs";
import path from "path";
import ora from "ora";
import { getToken } from "./auth.js";
import { printError, printStep, printSuccess } from "./ui.js";

// SlideForge job API (RafayGen ADK). Plan §10 specified an /api/cli actions
// round-trip; the backend shipped a dedicated job API instead, so this talks to
// it directly: POST /api/slides -> poll status -> download the PPTX.
const SLIDES_BASE =
  process.env.RG_SLIDES_URL?.replace(/\/$/, "") || "https://rafaygen.com";

function headers() {
  const h = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function runPpt(brief, opts) {
  const n = Math.min(30, Math.max(4, parseInt(opts.slides, 10) || 12));
  const brand = opts.brand === "sphf" ? "sphf" : "neutral";
  const lang = opts.lang === "ur" ? "ur" : "en";
  const seed = Math.floor(Date.now() / 1000) % 1000;

  let id;
  const spin = ora({ text: "Planning deck…", spinner: "dots12" }).start();
  try {
    const res = await fetch(`${SLIDES_BASE}/api/slides`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ prompt: brief, brand, slides: n, lang, seed }),
    });
    const data = await res.json();
    if (!res.ok || !data.id) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    id = data.id;
  } catch (e) {
    spin.stop();
    printError(`SlideForge failed to start: ${e.message}`);
    printError(
      `API: ${SLIDES_BASE}/api/slides — is RG_SLIDEFORGE on? (override with RG_SLIDES_URL)`,
    );
    return;
  }

  // Poll the job. The server's own budget (RG_SLIDEFORGE_BUDGET_S) bounds the
  // run; 3s polling for up to 5 minutes is comfortably beyond it.
  let job = null;
  for (let i = 0; i < 100; i++) {
    await sleep(3000);
    try {
      const res = await fetch(`${SLIDES_BASE}/api/slides/${id}`, {
        headers: headers(),
      });
      job = await res.json();
    } catch {
      continue; // transient — keep polling
    }
    const done = job.preview?.pngs?.length ?? 0;
    spin.text =
      job.status === "planning" || job.status === "queued"
        ? "Planning deck…"
        : job.status === "rendering"
          ? `Rendering… ${done}/${n} previews`
          : job.status === "reviewing"
            ? "Design review…"
            : job.status === "final" || job.status === "blocked"
              ? job.status
              : `${job.status} (loop ${job.revision})`;
    if (job.status === "final" || job.status === "blocked") break;
  }
  spin.stop();

  if (!job || job.status !== "final") {
    printError("Deck did not reach final.");
    for (const r of job?.blocked ?? []) printError(`  - ${r}`);
    return;
  }

  printStep("Downloading deck…");
  const r = await fetch(`${SLIDES_BASE}/api/slides/${id}/file`, {
    headers: headers(),
  });
  if (!r.ok) {
    printError(`Download failed: HTTP ${r.status}`);
    return;
  }
  const buf = Buffer.from(await r.arrayBuffer());
  const out = path.resolve(process.cwd(), opts.out);
  fs.writeFileSync(out, buf);
  printSuccess(`Deck saved → ${out}`);
  const f = job.final ?? {};
  console.log(
    `  ${f.slide_count ?? n} slides · brand ${brand} · revision ${f.revision ?? 1}` +
      `\n  layouts: ${(f.archetypes ?? []).join(" → ")}`,
  );
  for (const issue of f.open_issues ?? []) console.log(`  open: ${issue}`);
}
