// Static guards for layout bugs that have shipped before.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

// A <td> with display:flex stops being a table cell: it no longer stretches to
// the row height, so its row divider floats (Jobs/Estimates/Leads/Payments).
// Put the flex layout on an inner wrapper (.cell-actions-inner) instead.
const flexCells = html.match(/<td[^>]*style="[^"]*display:\s*(inline-)?flex/g) || [];
assert.deepStrictEqual(flexCells, [], 'table cells must not use display:flex; wrap the content in .cell-actions-inner');
assert.match(html, /\.cell-actions-inner\{display:flex;/, 'the action-cell wrapper style must exist');

// Absolutely positioned content inside a scrolling table (e.g. the sr-only
// "Actions" header) must be contained by the scroll box, or it widens the
// whole page at narrow window sizes.
assert.match(html, /\.table-wrap\{[^}]*overflow-x:auto;[^}]*position:relative;/, '.table-wrap must be a positioning context');

// Calendar chips truncate with CSS ellipsis, not by chopping text mid-word.
assert.ok(!/class="cal-ev[^\n]*\.slice\(0,\d+\)/.test(html),'calendar chips must not cut text with slice(); rely on text-overflow');

// .settings-hint has a negative top margin to tuck under form fields. Used as a
// description under a bold title (KPI picker, work queue, bays, templates,
// vendors), it overlapped the title until this override existed.
assert.match(html, /strong \+ \.settings-hint\{margin-top:2px;/, 'descriptions under bold titles must not inherit the negative form-hint margin');

// The Today's route row adapts to narrow cards instead of squeezing the job text.
assert.match(html, /\.route-card\{container-type:inline-size;\}/, 'the route card must be a size container');
assert.match(html, /@container \(max-width:560px\)\{\.route-row\{/, 'the route row must restack on narrow cards');

console.log('UI layout QA passed: real table cells, contained table overflow, ellipsis-based truncation, title/description spacing, responsive route row');
