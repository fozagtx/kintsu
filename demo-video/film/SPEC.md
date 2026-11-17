# SPEC: Kintsu, "The seam" (storyline A)

GOAL:    a stranger understands that Kintsu has Kane walk the flow where two agents' features meet, sends the evidence to the agent that owns the break, and re-runs until it passes.
OUTPUT:  HyperFrames, 1920 x 1080, 30 fps
TIME:    110 s x 30 = 3300 frames. Voice is the clock: 8 Kokoro lines (am_michael), each starting 0.6 s into its scene.
LOOK:    ground #ffffff. Ink #111111. Dashboard edge colours as they render: red #e5212e, green #00a35c, gray #9a9aa5. One accent, blue #1f5eff, for Kintsu and owner names.
         Display Inter 700 at 60 px, tracking -2%. Mono JetBrains Mono 500 at 28 to 30 px for diffs and ticket lines.
         Medium: the real product. The live graph replayed from the run's SQLite store (?at=), Kane's own step screenshots from the evidence packs, the agents' real diffs from commit a81a7e1.
OBJECTS: the Kintsu graph (five agent nodes, two seam edges); Kane's checkout screenshot ($4.50 discount, $44.55 total); Kane's confirmation screenshot ($39.60 paid); a repair ticket card; two diff cards.
MOTION:  camera pushes power2.inOut 1.0 to 1.2 s; arrivals expo.out 0.5 s; highlight boxes back.out(1.6) 0.25 s; lines blur in per word 0.13 s, 0.08 s apart, no slide; exits power3.in 0.3 s.
SHOTS:
  s1 0-11      graph, nothing run. Push toward the two gray seam edges. Band: "Each feature passes alone."
  s2 11-27.5   Kane's real checkout screenshot. Push onto the card, red box on -$4.50, then on $44.55. Band: "Kane, in a real browser: $4.50 off. Rules say $4.00."
  s3 27.5-38.5 graph after run 1: edge red. Push into the attribution text. Band: "Kane said pass. Kintsu checked the numbers."
  s4 38.5-52.5 repair ticket to coupon-agent, then the real pricing.ts diff.
  s5 52.5-64.5 graph after run 2: edge green. Band: "Same command. $45.10. Saved as a Kane test."
  s6 64.5-81   Kane's confirmation screenshot ($39.60 paid), red box; graph after run 3 routed to checkout-agent; real confirmation diff; graph after run 4, both green.
  s7 81-94.5   why it works: four lines, one at a time.
  s8 94.5-110  the run in numbers (11 min, 4 Kane walks, 2 agent fixes, 2 saved tests), then end card: Kintsu, repo URL, "Verified by Kane CLI".
BANNED:  dark ground, glow, gradients, glass, purple, numbered labels, pill chips, three cards in a row, docked logo, em dashes and fancy typography, drawn screenshots, any number not from the run.
QA:      t=4 graph legible; t=20 red box on -$4.50; t=33 attribution text readable; t=46 diff readable; t=58 green edge; t=68 red box on $39.60; t=100 numbers; t=108 URL inside title-safe.
