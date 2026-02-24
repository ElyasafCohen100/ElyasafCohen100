// fetch-github.js
// Runs in Node.js. Requires env var: GITHUB_TOKEN (classic PAT works).
// Output: stats.json (used by generate-dashboard.js)

const fs = require("fs");

const username = "ElyasafCohen100"; // 👈 אם תרצה, נהפוך את זה לדינאמי מה-ENV בהמשך
const token = process.env.GITHUB_TOKEN;

if (!token) {
  console.error("❌ GITHUB_TOKEN not found. Set it as env var or GitHub Actions secret.");
  process.exit(1);
}

function isoDateUTC(d) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysUTC(isoDate, days) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return isoDateUTC(dt);
}

function diffDaysUTC(a, b) {
  // returns b-a in days
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const A = Date.UTC(ay, am - 1, ad);
  const B = Date.UTC(by, bm - 1, bd);
  return Math.round((B - A) / 86400000);
}

function calcLongestStreak(days) {
  // days: [{date:'YYYY-MM-DD', count:number}] sorted asc
  let best = 0;
  let cur = 0;
  for (let i = 0; i < days.length; i++) {
    const isActive = days[i].count > 0;
    if (!isActive) {
      cur = 0;
      continue;
    }

    if (i === 0) {
      cur = 1;
    } else {
      const gap = diffDaysUTC(days[i - 1].date, days[i].date);
      if (gap === 1) cur += 1;
      else cur = 1;
    }
    if (cur > best) best = cur;
  }
  return best;
}

function calcCurrentStreakLikeGitHub(days) {
  // GitHub "Current streak" typically means consecutive active days ending today,
  // BUT if today has 0 contributions, it counts streak ending yesterday.
  // We'll implement that.

  if (days.length === 0) return 0;

  const today = isoDateUTC(new Date());
  const lastDay = days[days.length - 1].date;

  // Ensure we have up to "today" in the array; if not, treat missing as 0 for today.
  let effectiveEndDate = today;
  let endIndex = days.length - 1;

  if (lastDay !== today) {
    // If we don't have today's entry, pretend today is 0.
    // If yesterday is lastDay, fine; if not, there is a gap anyway.
    // For current streak, end date can only be today or yesterday depending on today's count.
  }

  // Find today's count (0 if missing)
  let todayCount = 0;
  if (lastDay === today) todayCount = days[endIndex].count;

  // If today is 0 -> streak ends yesterday
  if (todayCount === 0) {
    effectiveEndDate = addDaysUTC(today, -1);
  }

  // Now count backwards while days are active and consecutive.
  // We'll build a map date->count for quick lookup (handles missing days as 0).
  const map = new Map(days.map(d => [d.date, d.count]));

  let streak = 0;
  let cursor = effectiveEndDate;

  while (true) {
    const c = map.get(cursor) ?? 0;
    if (c <= 0) break;
    streak += 1;
    cursor = addDaysUTC(cursor, -1);
  }

  return streak;
}

function calcCommitPercent(days, windowDays = 90) {
  // "commitPercent" = percent of days with contributions in last N days (default 90)
  // You liked this visually; it's stable and looks good.
  const map = new Map(days.map(d => [d.date, d.count]));
  const today = isoDateUTC(new Date());
  let active = 0;
  for (let i = 0; i < windowDays; i++) {
    const date = addDaysUTC(today, -i);
    if ((map.get(date) ?? 0) > 0) active += 1;
  }
  return Math.round((active / windowDays) * 100);
}

async function fetchGitHubContribData() {
const now = new Date();
const oneYearAgo = new Date();
oneYearAgo.setUTCFullYear(now.getUTCFullYear() - 1);

const from = oneYearAgo.toISOString();
const to = now.toISOString();

  const query = `
    query ($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) {
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
              }
            }
          }
        }
      }
    }
  `;

  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      "Authorization": `bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      variables: { login: username, from, to },
    }),
  });

  const json = await res.json();

  if (!res.ok || json.errors) {
    console.error("❌ GitHub API error:", JSON.stringify(json.errors || json, null, 2));
    process.exit(1);
  }

  const calendar = json.data.user.contributionsCollection.contributionCalendar;
  const days = calendar.weeks
    .flatMap(w => w.contributionDays)
    .map(d => ({ date: d.date, count: d.contributionCount }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const totalContributions = calendar.totalContributions;

  const currentStreak = calcCurrentStreakLikeGitHub(days);
  const longestStreak = calcLongestStreak(days);

  // 🔥 Important: if your 8 streak is private contributions, GraphQL *still* includes them
  // only if GitHub counts them as contributions for your account. (Typically yes).
  // If still mismatch, we'll add "includePrivateContributions: true" via REST alternative,
  // but usually contributionsCollection already reflects what GitHub shows.

  const commitPercent = calcCommitPercent(days, 90);

  const stats = {
    username,
    totalContributions,
    currentStreak,
    longestStreak,
    commitPercent,
    generatedAt: new Date().toISOString(),
  };

  fs.writeFileSync("stats.json", JSON.stringify(stats, null, 2));
  console.log("✅ stats.json written:", stats);
}

fetchGitHubContribData().catch(err => {
  console.error("❌ Unexpected error:", err);
  process.exit(1);
});
