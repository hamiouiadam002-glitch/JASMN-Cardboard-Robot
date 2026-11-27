# JASMN Phase 1.2: final two corrections

Worked from the uploaded `JASMN_Phase1_2.html` (77-test version). Exact copy before these changes: `JASMN_Phase1_2.pre-finalfix.backup.html`.

## Fix A: no guessed daily reset
- `msToPacificMidnight()` now returns `null` if the timezone calculation throws or gives a non-finite, non-positive or >24 h value. The `return 3600000` guess is gone.
- `httpFail()` (Gemini daily branch) only sets a reset when the value is not `null`. Otherwise the existing "unknown reset" path applies: no timer, nothing persisted, original question kept, 60 s pause between manual retries.
- Valid Gemini midnight and Groq reset handling are unchanged.

## Fix B: neutral Gemini Search message
The blanket "free tier does not include Google Search" clause was removed from the English, French and Arabic `notool` messages. English now reads: "Web search isn't available with my current keys and models, so I won't guess about current information. Normal conversation still works." Routing, classification and cooldowns are untouched.

## Mocked tests (no real API calls)
`node JASMN_tests.js JASMN_Phase1_2.html`: **89 passed, 0 failed** (77 existing + 12 new, section 22). The final run's output is in `mocked_test_output.txt`.
Note: I ran the suite several times, not once. Early runs failed only because of mistakes in my new test setup (not the HTML); I fixed the tests and the final run is clean. The HTML was not changed between those runs.

New tests: 22a-b2 timezone failure / NaN / out-of-range -> null; 22c-f unknown reset: no timer, nothing persisted, question kept, manual retry blocked before 60 s and working after, no background timers; 22g valid Gemini midnight unchanged; 22h-i neutral EN/FR/AR wording; 22j normal Gemini chat; 22k Groq search fallback.

The tests do not exercise Groq's own reset handling again beyond the existing 20a-20l. Real API testing was NOT run.
