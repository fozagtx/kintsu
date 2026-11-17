# Kintsu demo film: three storylines

Source: the recorded run of 2026-11-17 (timestamped terminal log, live-graph screenshots every few seconds, Kane evidence packs with per-step screenshots, the repair agents' real diffs, the sealed _test.md files). Nothing on screen is drawn to look like a result: every number, screenshot and line comes from that run.

Order follows the PRD demo script: problem (about 15 s), the live loop (about 90 s), why it works (about 30 s), what's next (about 15 s). Assumed length 2:30 to 3:00, 1920x1080, Kokoro voiceover (am_michael), the existing bundled and CC0 sound effects, no music unless you supply a track.

## A. The seam (recommended: the graph is the story, so a stranger can follow it)

Device: the feature agents are the world, the seam is the hero. Form: one home stage that rebuilds, the live graph, with dives into the evidence and back.

Opens on the real graph: five agent nodes, every feature check green. One line: "Coupons work. Gift wrap works." The coupon-plus-wrap edge is gray, then Kane walks it, and the camera dives into Kane's real checkout screenshot: discount $4.50 where the rules say $4.00. Back on the graph the edge turns red, a repair ticket travels along it into coupon-agent, the agent's real one-line diff lands, Kane re-runs the identical command, and the edge turns green. The second seam repeats it faster: confirmation shows a different total than checkout, the ticket goes to checkout-agent, green. Ends on the two sealed _test.md contracts.

- First 2 s: the real graph, all nodes calm, then a single gray edge between coupon-agent and checkout-agent starts to pulse with Kane's live step remarks.
- Beats: problem (each feature passes alone) -> Kane walks the seam -> dive: $4.50 in the real screenshot -> red edge, attribution reason -> ticket to coupon-agent -> real diff -> identical re-run -> green -> second seam, faster -> sealed contracts -> why it works -> what's next -> end card.
- Look: the dashboard's own white ground and edge colours (red #e5212e, green #00a35c, amber #ff9f00, gray), one blue accent #1f5eff for Kintsu. Real screenshots at full size, never a dimmed backdrop.
- Sound: soft key ticks under live remarks, one hard hit when the edge turns red, a clean click when it turns green. Voice carries the words.

## B. The receipt

Device: the evidence pack is the object. Form: one object carried through each step.

The film follows one sealed Kane evidence pack. It opens, its step screenshots fan out, failure.yaml is read line by line, the pack is "addressed" to coupon-agent by the attribution reason, the agent opens it and writes the fix, and a new pack comes back sealed green. The graph appears only at the end as the summary.

- First 2 s: a zip file icon labelled with the real execution id snaps open; the real step 11 screenshot slides out.
- Beats: pack opens -> real screenshot and failure record -> addressed to the owner -> fix -> new pack, passed -> both seams on the graph -> end card.
- Look: white ground, the pack as a flat folder in blue, screenshots and YAML as real text.
- Sound: paper and zip foley if available, one hit on the failure line.

## C. Fifteen minutes in ninety seconds

Device: the result first, then how it got there. Form: split screen to one.

The real recording, sped up: the terminal log scrolls on the left while the live graph screenshots play on the right at their real timestamps, edges turning red and green in the order they really did. Three freeze-frames stop the time-lapse to explain the catch, the hand-off and the seal, then it runs on to the end.

- First 2 s: the final frame (both seams green, two contracts sealed), then it rewinds to the start.
- Beats: final state -> rewind -> time-lapse with real timestamps -> freeze: the $4.50 catch -> freeze: ticket to coupon-agent and the diff -> freeze: sealed _test.md -> end card.
- Look: the dashboard and terminal as they were, a running clock in the corner showing real elapsed time.
- Sound: a steady pulse under the time-lapse, silence on each freeze.
