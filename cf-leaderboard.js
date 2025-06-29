// ==UserScript==
// @name         Codeforces Daily Leaderboard
// @namespace    http://tampermonkey.net/
// @version      1.8
// @description  View daily leaderboard on Codeforces with expandable user details
// @author       nobody
// @match        https://codeforces.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

// scoring here: https://pasteboard.co/LvYf8Be7w7N9.png

(async function() {
  const USERNAMES = ['tooourist', 'Ekber_Ekber', 'AzeTurk810', 'AtillaMA']; // change this as you want
  const SCORE_MAP = [
    { low: 800, high: 1400, pts: 0 },
    { low: 1500, high: 1600, pts: 25 },
    { low: 1700, high: 1800, pts: 75 },
    { low: 1900, high: 2000, pts: 100 },
    { low: 2100, high: 2300, pts: 150 },
    { low: 2400, high: 3500, pts: 250 }
  ];

  function getScore(r) {
    for (const m of SCORE_MAP) if (r >= m.low && r <= m.high) return m.pts;
    return 0;
  }

  function addStyles() {
  const css = `
    #cf-leaderboard-btn {
      position: fixed;
      left: 20px;
      bottom: 20px;
      padding: 8px 14px;
      border-radius: 4px;
      background: #2a5885;
      color: white;
      font-weight: 600;
      border: none;
      cursor: pointer;
      /* Removed box-shadow and transition */
      z-index: 1100;
    }
    #cf-leaderboard-btn:hover {
      background: #20416a;
      /* No animation on hover */
    }

    /* Rest styles unchanged */
    .leaderboard {
      width: 100%;
      border-collapse: collapse;
      font-family: 'Verdana', sans-serif;
      font-size: 14px;
      margin-top: 12px;
    }
    .leaderboard th, .leaderboard td {
      border: 1px solid #c7d0db;
      padding: 8px 10px;
      text-align: center;
    }
    .leaderboard thead {
      background: #2a5885;
      color: white;
      user-select: none;
    }
    .leaderboard tbody tr.cf-user-row:hover {
      background: #d9e5f7;
      cursor: pointer;
    }

    tr.cf-details-row {
      background: #e9f0fb;
    }

    .cf-details-inner {
      background: white;
      margin: 10px auto;
      padding: 12px 16px;
      border: 1px solid #aac3e7;
      border-radius: 6px;
      box-shadow: 0 2px 8px rgb(42 88 133 / 0.15);
      font-size: 13px;
    }
    .cf-details-inner strong {
      color: #20416a;
      display: block;
      margin-bottom: 8px;
    }
    .cf-details-inner table {
      width: 100%;
      border-collapse: collapse;
    }
    .cf-details-inner th, .cf-details-inner td {
      border: 1px solid #aac3e7;
      padding: 6px 8px;
      text-align: center;
      font-weight: normal;
    }
    .cf-details-inner thead {
      background: #2a5885;
      color: white;
    }
    .cf-details-inner a {
      color: #2a5885;
      text-decoration: none;
    }
    .cf-details-inner a:hover {
      text-decoration: underline;
    }
  `;
  const styleTag = document.createElement('style');
  styleTag.textContent = css;
  document.head.appendChild(styleTag);
}


  function createButton(id, text) {
    const btn = document.createElement('button');
    btn.id = id;
    btn.textContent = text;
    document.body.appendChild(btn);
    return btn;
  }

  function createPopup(title, contentHTML) {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = 0;
    overlay.style.left = 0;
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.background = 'rgba(0,0,0,0.3)';
    overlay.style.zIndex = 2000;
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';

    const popup = document.createElement('div');
    popup.style.background = 'white';
    popup.style.borderRadius = '8px';
    popup.style.maxWidth = '700px';
    popup.style.width = '90%';
    popup.style.maxHeight = '80vh';
    popup.style.overflowY = 'auto';
    popup.style.boxShadow = '0 10px 30px rgba(0,0,0,0.15)';
    popup.style.fontFamily = "'Verdana', sans-serif";

    const header = document.createElement('div');
    header.style.background = '#2a5885';
    header.style.color = 'white';
    header.style.padding = '12px 20px';
    header.style.fontSize = '18px';
    header.style.fontWeight = '600';
    header.textContent = title;

    const content = document.createElement('div');
    content.style.padding = '15px 20px';
    content.innerHTML = contentHTML;

    popup.appendChild(header);
    popup.appendChild(content);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    function closePopup() {
      document.body.removeChild(overlay);
      document.body.style.overflow = '';
      window.removeEventListener('keydown', escHandler);
    }
    function escHandler(e) {
      if (e.key === 'Escape') closePopup();
    }
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closePopup();
    });
    window.addEventListener('keydown', escHandler);
    document.body.style.overflow = 'hidden';

    return content;
  }

  function isToday(ts) {
    const d = new Date(ts * 1000), now = new Date();
    return d.getUTCFullYear() === now.getUTCFullYear() &&
           d.getUTCMonth() === now.getUTCMonth() &&
           d.getUTCDate() === now.getUTCDate();
  }

  async function fetchSubmissions(user) {
    try {
      const res = await fetch(`https://codeforces.com/api/user.status?handle=${user}&from=1&count=1000`);
      const data = await res.json();
      if (data.status !== 'OK') throw new Error(data.comment || 'API error');
      return data.result;
    } catch (err) {
      console.error(`Error fetching submissions for ${user}:`, err);
      return [];
    }
  }

  async function calcLeaderboard() {
    const overview = [];
    for (const u of USERNAMES) {
      const subs = await fetchSubmissions(u);
      const firstMap = new Map();
      for (const s of subs) {
        if (s.verdict !== 'OK') continue;
        const pid = `${s.problem.contestId}-${s.problem.index}`;
        if (!firstMap.has(pid) || s.creationTimeSeconds < firstMap.get(pid))
          firstMap.set(pid, s.creationTimeSeconds);
      }
      const userDetail = { user: u, total: 0, count: 0, byRating: {}, problems: [] };
      for (const [pid, t] of firstMap.entries()) {
        if (!isToday(t)) continue;
        const submission = subs.find(s => `${s.problem.contestId}-${s.problem.index}` === pid && s.verdict === 'OK');
        const rating = submission?.problem?.rating || 0;
        if (rating < 1500) continue;
        const pts = getScore(rating);
        userDetail.count++;
        userDetail.total += pts;
        if (rating) {
          userDetail.byRating[rating] = (userDetail.byRating[rating] || 0) + 1;
          userDetail.problems.push({ contestId: submission.problem.contestId, index: submission.problem.index, rating });
        }
      }
      for (const [rating, count] of Object.entries(userDetail.byRating)) {
        if (count >= 3) {
          userDetail.total += getScore(Number(rating)) * 0.2;
          break;
        }
      }
      if (Object.keys(userDetail.byRating).length >= 3) {
        userDetail.total += 50;
      }
      overview.push(userDetail);
    }
    return overview.sort((a, b) => b.total - a.total);
  }

  function renderDetails(userData) {
    const rows = Object.entries(userData.byRating).sort((a, b) => b[0] - a[0])
      .map(([r, c]) => {
        const links = userData.problems.filter(p => p.rating === +r)
          .map(p => `<a href="https://codeforces.com/problemset/problem/${p.contestId}/${p.index}" target="_blank">${p.contestId}${p.index}</a>`).join(', ');
        return `<tr><th>${r}</th><td>${c}</td><td>${links}</td></tr>`;
      }).join('');

    return `
      <tr class="cf-details-row">
        <td colspan="3">
          <div class="cf-details-inner">
            <strong>Solved: ${userData.count} problems, Total Points: ${userData.total.toFixed(1)}</strong>
            <table>
              <thead><tr><th>Rating</th><th>Count</th><th>Problems</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </td>
      </tr>
    `;
  }

  function renderLeaderboard(data) {
    if (!data.length) return '<p>No solves today.</p>';
    let html = '<table class="leaderboard"><thead><tr><th>#</th><th>User</th><th>Points</th></tr></thead><tbody>';
    data.forEach((e, i) => {
      html += `<tr class="cf-user-row" data-user="${e.user}"><td>${i + 1}</td><td>${e.user}</td><td>${e.total.toFixed(1)}</td></tr>`;
    });
    html += '</tbody></table>';
    return html;
  }

  addStyles();

  const leaderboardBtn = createButton('cf-leaderboard-btn', 'Leaderboard');

  leaderboardBtn.onclick = async () => {
    const content = createPopup('Daily Leaderboard', '<p>Loading…</p>');
    try {
      const data = await calcLeaderboard();
      content.innerHTML = renderLeaderboard(data);

      content.querySelectorAll('.cf-user-row').forEach(row => {
        row.addEventListener('click', () => {
          const next = row.nextElementSibling;
          const alreadyOpen = next?.classList.contains('cf-details-row');
          document.querySelectorAll('tr.cf-details-row').forEach(r => r.remove());

          if (!alreadyOpen) {
            const info = data.find(d => d.user === row.dataset.user);
            row.insertAdjacentHTML('afterend', renderDetails(info));
          }
        });
      });
    } catch (err) {
      content.innerHTML = `<p>Error loading leaderboard: ${err.message}</p>`;
      console.error(err);
    }
  };

})();
