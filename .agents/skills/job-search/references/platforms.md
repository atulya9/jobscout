# Platform roster and retrieval matrix

Check every enabled row in `data/search-sources.csv` on each daily run. The matrix below is a starting playbook, not permission to mark a source checked without opening it.

| Platform | Preferred method | Fallback | Login | Notes |
|---|---|---|---|---|
| LinkedIn Jobs | Logged-in Chrome via Chrome DevTools | Playwright extension; then public web snippets | Usually | Use search filters in the existing session. Verify on employer/ATS page whenever possible. |
| Naukri | Logged-in Chrome | Playwright extension | Recommended | Search results and complete details are more reliable in-session. |
| Hirist | Logged-in Chrome | Public fetch, Playwright extension | Recommended | Public pages may work; use session for filters and hidden details. |
| Cutshort | Logged-in Chrome | Playwright extension | Recommended | Session improves eligibility and application visibility. |
| Instahyre | Logged-in Chrome | Playwright extension | Yes | Do not treat invisible jobs as verified. |
| Wellfound | Logged-in Chrome | Playwright extension; public company page | Recommended | Capture salary/equity and startup stage when shown. |
| YC Work at a Startup | Direct web fetch | Logged-in Chrome; company careers page | No for browsing | Prefer current company posting. If a company is marked excluded in preferences, skip only that company. |
| Remote.com Jobs | Direct web fetch | Playwright/Chrome | No | Distinguish Remote's own careers from the job marketplace. |
| Himalayas | Direct web fetch | Logged-in Chrome | No for browsing | Verify country restrictions even when the role says remote. |
| We Work Remotely | Direct web fetch | Employer page | No | Verify application URL and geographic restrictions. |
| Remote OK | Direct web fetch | Employer page | No | Aggregated/stale entries require an employer-side check. |
| Indeed India | Logged-in Chrome | Public fetch; Playwright extension | Recommended | Prefer employer posting; sponsored duplicates are common. |
| Working Nomads | Direct web fetch | Employer page | No | Verify freshness and location on the canonical page. |
| Built In | Direct web fetch | Chrome/Playwright; employer page | Usually no | Regional pages may hide country eligibility. |
| Arc.dev | Logged-in Chrome | Playwright extension | Recommended | Some opportunities are profile-matched rather than public listings. |
| Weekday | Direct web fetch | Logged-in Chrome/Playwright | Sometimes | Resolve recruiter/aggregator entries to the canonical job. |
| Employer career sites | Direct web fetch | Chrome/Playwright | Usually no | Canonical source for validity and location. |
| Greenhouse | Direct employer board/API page | Chrome/Playwright | No | Usually highly readable. Preserve the Greenhouse job ID. |
| Lever | Direct employer board/API page | Chrome/Playwright | No | Usually highly readable. Preserve the posting ID. |
| Ashby | Direct web fetch | Chrome DevTools, then Playwright extension | No | JavaScript rendering varies. Use structured data or canonical Ashby posting. |
| Workday | Chrome DevTools | Playwright extension; public endpoint/snippet | No for most jobs | Dynamic and tenant-specific; verify the application action. |
| SmartRecruiters | Direct web fetch | Chrome/Playwright | No | Prefer canonical company tenant URL. |
| Workable | Direct web fetch | Chrome/Playwright | No | Prefer canonical employer page. |
| Founding/early-stage sources | Wellfound, YC, founder posts, VC portfolios | Employer/founder page | Varies | Confirm role is active, engineering scope, stage, cash/equity, location, and founder contact route. |

## Retrieval rules

- Direct web fetch is fastest for public ATS and career pages; use it first when the page content is complete.
- Use Chrome DevTools `--autoConnect` for the user's existing Chrome profile and open tabs. It requires Chrome 144+ and Remote Debugging enabled at `chrome://inspect/#remote-debugging`.
- Use Playwright MCP with `--extension` to connect to existing Chrome/Edge tabs. The Playwright Extension must be installed and the connection approved.
- If a page is blocked by bot protection, login, region, broken rendering, or missing content, try the canonical employer URL and the other browser MCP. Do not bypass CAPTCHAs or access controls.
- Search snippets can discover a listing but cannot prove the JD or application link is valid.
- Record portals that were blocked or not checked. Never shrink the apparent roster by omitting failures.
