import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Anthropic from "@anthropic-ai/sdk";
import {
  ScorecardAnalysisInput,
  ScorecardAnalysisResult,
  ClaudeScorecardResponse,
  AnalysisConfidence,
  BowlerFrameData,
} from "./types";

@Injectable()
export class ScorecardAnalysisService {
  private readonly logger = new Logger(ScorecardAnalysisService.name);
  private readonly anthropic: Anthropic;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>("ANTHROPIC_API_KEY");
    if (!apiKey) {
      this.logger.warn(
        "ANTHROPIC_API_KEY not configured - scorecard analysis will not function",
      );
    }
    this.anthropic = new Anthropic({ apiKey });
  }

  async analyzeScorecard(
    input: ScorecardAnalysisInput,
  ): Promise<ScorecardAnalysisResult> {
    const startTime = Date.now();

    try {
      this.logger.log("Starting scorecard analysis");

      const prompt = this.buildPrompt(input);

      const response = await this.anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: input.mediaType,
                  data: input.imageBase64,
                },
              },
              {
                type: "text",
                text: prompt,
              },
            ],
          },
        ],
      });

      const processingTimeMs = Date.now() - startTime;

      const textContent = response.content.find(
        (block) => block.type === "text",
      );
      if (!textContent || textContent.type !== "text") {
        throw new Error("No text content in Claude response");
      }

      const parsed = this.parseResponse(textContent.text);
      const result = this.transformToResult(parsed, processingTimeMs);

      this.logger.log(
        `Scorecard analysis completed in ${processingTimeMs}ms - confidence: ${result.confidence}`,
      );

      return result;
    } catch (error) {
      const processingTimeMs = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      this.logger.error(`Scorecard analysis failed: ${errorMessage}`, error);

      return this.createUnreadableResult(processingTimeMs, errorMessage);
    }
  }

  private buildPrompt(input: ScorecardAnalysisInput): string {
    const bowlerList = input.expectedBowlers
      .map((b) => `  - "${b.name}" (ID: ${b.id})`)
      .join("\n");

    return `You are an expert at reading bowling scorecards. Your task is to analyze this photo of a bowling scorecard and extract all scoring data.

## Expected Bowlers

The following 4 bowlers are expected on this scorecard:
${bowlerList}

## CRITICAL — How to Read Bowling Scorecard Symbols

Bowling scorecards use specific symbols. You MUST understand these before extracting any data:

| Symbol on scorecard | Meaning | How to record |
|---|---|---|
| **X** | Strike — all 10 pins knocked down on the FIRST ball | ball1_score: 10, ball2_score: null (frames 1-9) |
| **/** | Spare — all REMAINING pins knocked down on the SECOND ball | ball2_score = (10 - ball1_score). Example: if ball 1 shows "7" and ball 2 shows "/", then ball1_score: 7, ball2_score: 3 (because 10 - 7 = 3) |
| **-** (dash/hyphen) | Zero / miss — no pins knocked down on that ball | Record as 0 |
| **1** | Knocked down exactly 1 pin | Record as 1 |
| **2** | Knocked down exactly 2 pins | Record as 2 |
| **3** | Knocked down exactly 3 pins | Record as 3 |
| **4** | Knocked down exactly 4 pins | Record as 4 |
| **5** | Knocked down exactly 5 pins | Record as 5 |
| **6** | Knocked down exactly 6 pins | Record as 6 |
| **7** | Knocked down exactly 7 pins | Record as 7 |
| **8** | Knocked down exactly 8 pins | Record as 8 |
| **9** | Knocked down exactly 9 pins | Record as 9 |
| **Circle around a number** | Split — the first ball left a split. Record the number as ball1_score and set is_ball1_split: true |

### Key symbol rules:
- **"/" is ALWAYS a spare on the SECOND ball.** It means the bowler knocked down whatever pins were left. To calculate ball2_score: subtract ball1_score from 10. For example: "6/" means ball1_score: 6, ball2_score: 4. "3/" means ball1_score: 3, ball2_score: 7. "-/" means ball1_score: 0, ball2_score: 10.
- **"-" is ALWAYS a zero (0).** It means the bowler knocked down 0 pins on that ball. "-" as ball 1 = ball1_score: 0. "-" as ball 2 = ball2_score: 0.
- **A number like "1", "2", "3", etc. is ALWAYS a literal pin count.** "1" means 1 pin knocked down. "9" means 9 pins knocked down.
- **"X" is ALWAYS a strike (10 pins on first ball).**

### CRITICAL — Distinguishing "/" from "1"
The "/" (spare) and "1" (one pin) symbols look VERY similar on handwritten scorecards. When you see a mark that could be "/" or "1" in the ball 2 position, you MUST use the **running totals and/or final score** written on the scorecard to determine which it is:

- **If interpreting it as "/" (spare) makes the running totals match** what's written on the scorecard → it IS a spare "/".
- **If interpreting it as "1" makes the running totals match** what's written on the scorecard → it IS a "1".
- A spare (/) gives a bonus: the frame score = 10 + next ball. A "1" gives no bonus: the frame score = ball1 + 1. This leads to VERY different running totals, so the cumulative scores on the scorecard will clearly tell you which reading is correct.
- **When in doubt, always check the math against the running totals on the scorecard.** The running totals are your source of truth for disambiguating "/" vs "1".

## Your Analysis Process

### Step 1 — Verify Bowler Names
Look at the scorecard and identify the names of all bowlers listed. Match each detected name to one of the expected bowlers above. Names may be abbreviated, use nicknames, or be handwritten — use your best judgment to match them. If you cannot confidently match all 4 bowlers, set confidence to "LOW" or "UNREADABLE" and explain why.

### Step 2 — Verify Frame Readability
For each bowler, verify that you can read all 10 frames. Check that the marks/scores are legible. If any frames are unclear, note which ones and reduce confidence accordingly.

### Step 3 — Extract Scores
For EACH bowler and EACH frame, first identify what symbols are written on the scorecard, then convert them to numeric pin counts following the symbol rules above.

**For each frame, think step by step:**
1. What symbol is in the ball 1 box? Convert it: X=10, -=0, number=that number
2. What symbol is in the ball 2 box? Convert it: /=(10 - ball1_score), -=0, number=that number, empty=null (only when ball 1 was a strike in frames 1-9)
3. Is ball 1 circled (split indicator)?

**Frame 10 special rules:**
- If ball 1 is a strike (X), the bowler gets ball 2 AND ball 3.
- If ball 1 + ball 2 is a spare (/), the bowler gets ball 3.
- If ball 1 + ball 2 < 10 (open frame), ball3_score is null.
- ball2_score in frame 10 is NEVER null — the bowler always throws ball 2 in the 10th frame.
- In the 10th frame, if ball 1 is a strike and ball 2 is also a strike, that means ball2_score: 10 (it resets to a fresh rack of 10 pins).
- In the 10th frame, if ball 1 is a strike and ball 2 is NOT a strike, "/" on ball 3 means ball3_score = 10 - ball2_score.

**IGNORE any handicap rows** — only extract actual bowling scores.
**Always return numeric pin counts as integers, never symbols like "X" or "/".**

### Step 4 — Cross-Check Against Running Totals (MANDATORY)
Bowling scorecards typically have a running cumulative total written below each frame. After you extract all ball scores for a bowler, you MUST:
1. Calculate the cumulative score yourself using standard bowling scoring rules (strikes get +next 2 balls, spares get +next 1 ball).
2. Compare YOUR calculated running totals against the running totals WRITTEN on the scorecard photo.
3. If they don't match, go back and re-examine the frames where the totals diverge. The most common error is reading "/" as "1" or vice versa — re-check those frames first.
4. Adjust your extracted scores until your calculated totals match what's on the scorecard.
5. If you still can't make the totals match after re-examining, reduce confidence to "MEDIUM" or "LOW" and explain the discrepancy in your reasoning.

This step is ESPECIALLY important for disambiguating "/" vs "1" — a spare adds a bonus (10 + next ball) while a "1" does not, which causes dramatically different running totals. The totals on the scorecard are your ground truth.

## Worked Examples

Example 1: Frame shows "7 /"
→ ball1_score: 7, ball2_score: 3 (because / means 10 - 7 = 3), is_ball1_split: false

Example 2: Frame shows "X"
→ ball1_score: 10, ball2_score: null, is_ball1_split: false

Example 3: Frame shows "- 3"
→ ball1_score: 0 (dash = zero), ball2_score: 3, is_ball1_split: false

Example 4: Frame shows "8 -"
→ ball1_score: 8, ball2_score: 0 (dash = zero), is_ball1_split: false

Example 5: Frame shows "(7) /"  (7 is circled = split)
→ ball1_score: 7, ball2_score: 3, is_ball1_split: true

Example 6: Frame shows "- -"
→ ball1_score: 0, ball2_score: 0, is_ball1_split: false

Example 7: 10th frame shows "X X 8"
→ ball1_score: 10, ball2_score: 10, ball3_score: 8, is_ball1_split: false

Example 8: 10th frame shows "7 / X"
→ ball1_score: 7, ball2_score: 3, ball3_score: 10, is_ball1_split: false

Example 9: 10th frame shows "X 7 /"
→ ball1_score: 10, ball2_score: 7, ball3_score: 3 (/ means 10 - 7 = 3), is_ball1_split: false

Example 10: 10th frame shows "8 1" (open frame, no third ball)
→ ball1_score: 8, ball2_score: 1, ball3_score: null, is_ball1_split: false

## Response Format

Return ONLY a JSON object with this exact structure (no markdown, no explanation outside JSON):

{
  "bowler_verification": {
    "detected_names": ["name1", "name2", "name3", "name4"],
    "matched": true/false,
    "match_details": "explanation of how names were matched"
  },
  "frame_verification": {
    "all_frames_readable": true/false,
    "details": "any notes about readability issues"
  },
  "bowlers": [
    {
      "scorecard_name": "name as it appears on scorecard",
      "matched_bowler_id": "uuid-from-expected-bowlers",
      "frames": [
        {
          "frame_number": 1,
          "ball1_score": 7,
          "ball2_score": 2,
          "ball3_score": null,
          "is_ball1_split": false
        },
        {
          "frame_number": 2,
          "ball1_score": 10,
          "ball2_score": null,
          "ball3_score": null,
          "is_ball1_split": false
        },
        ...
        {
          "frame_number": 10,
          "ball1_score": 10,
          "ball2_score": 10,
          "ball3_score": 8,
          "is_ball1_split": false
        }
      ]
    }
  ],
  "confidence": "HIGH" | "MEDIUM" | "LOW" | "UNREADABLE",
  "reasoning": "Your explanation of the analysis. For EACH frame, briefly note what symbols you saw and how you converted them (e.g. 'Frame 1: saw 7/ → 7, 3'). Flag any uncertainties."
}

## Critical Rules

- If you cannot read the image clearly, set confidence to "UNREADABLE"
- Always return pin counts as integers, never symbols
- Never fabricate scores — if a frame is unreadable, set confidence to "LOW" and explain
- "/" ALWAYS means spare: ball2_score = 10 minus ball1_score. NEVER record "/" as a literal value.
- "-" ALWAYS means 0 pins. NEVER skip it or treat it as missing.
- A number "1" through "9" is ALWAYS a literal pin count.
- **When a ball 2 mark is ambiguous between "/" and "1", USE THE RUNNING TOTALS on the scorecard to decide.** A spare gives a large bonus; a "1" does not. Calculate both interpretations and see which matches the cumulative totals written on the card.
- A strike on frames 1-9 always has ball2_score: null and ball3_score: null
- Frame 10 ball2_score is NEVER null
- Ignore handicap lines completely
- Match each bowler to exactly one expected bowler ID — no duplicates
- YOUR FINAL CALCULATED TOTALS MUST MATCH THE TOTALS ON THE SCORECARD. If they don't, re-examine your readings.`;
  }

  private parseResponse(rawResponse: string): ClaudeScorecardResponse {
    let jsonString = rawResponse.trim();

    // Handle markdown code blocks
    if (jsonString.startsWith("```json")) {
      jsonString = jsonString.slice(7);
    } else if (jsonString.startsWith("```")) {
      jsonString = jsonString.slice(3);
    }

    if (jsonString.endsWith("```")) {
      jsonString = jsonString.slice(0, -3);
    }

    jsonString = jsonString.trim();

    try {
      return JSON.parse(jsonString) as ClaudeScorecardResponse;
    } catch (parseError) {
      this.logger.error(
        `Failed to parse Claude response as JSON: ${rawResponse}`,
      );
      throw new Error("Failed to parse scorecard analysis response as JSON");
    }
  }

  private transformToResult(
    parsed: ClaudeScorecardResponse,
    processingTimeMs: number,
  ): ScorecardAnalysisResult {
    const bowlers: BowlerFrameData[] = parsed.bowlers.map((b) => ({
      bowlerName: b.scorecard_name,
      matchedBowlerId: b.matched_bowler_id,
      frames: b.frames.map((f) => ({
        frameNumber: f.frame_number,
        ball1Score: f.ball1_score,
        ball2Score: f.ball2_score,
        ball3Score: f.ball3_score,
        isBall1Split: f.is_ball1_split,
      })),
    }));

    const confidence = this.mapConfidence(parsed.confidence);

    return {
      success: confidence !== AnalysisConfidence.UNREADABLE,
      confidence,
      bowlers,
      reasoning: parsed.reasoning,
      processingTimeMs,
    };
  }

  private createUnreadableResult(
    processingTimeMs: number,
    errorMessage: string,
  ): ScorecardAnalysisResult {
    return {
      success: false,
      confidence: AnalysisConfidence.UNREADABLE,
      bowlers: [],
      reasoning: `Analysis failed: ${errorMessage}`,
      processingTimeMs,
      errorMessage,
    };
  }

  private mapConfidence(confidence: string): AnalysisConfidence {
    const mapping: Record<string, AnalysisConfidence> = {
      HIGH: AnalysisConfidence.HIGH,
      MEDIUM: AnalysisConfidence.MEDIUM,
      LOW: AnalysisConfidence.LOW,
      UNREADABLE: AnalysisConfidence.UNREADABLE,
    };
    return mapping[confidence] ?? AnalysisConfidence.UNREADABLE;
  }
}
