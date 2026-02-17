/**
 * Scorecard Analysis Types
 *
 * Types for the scorecard analysis module that extracts structured
 * bowling score data from photos of scorecards using Claude vision.
 */

// ============================================================================
// Enums
// ============================================================================

export enum AnalysisConfidence {
  HIGH = "HIGH",
  MEDIUM = "MEDIUM",
  LOW = "LOW",
  UNREADABLE = "UNREADABLE",
}

// ============================================================================
// Input Types
// ============================================================================

export interface ExpectedBowler {
  id: string;
  name: string;
}

export interface ScorecardAnalysisInput {
  /** Base64-encoded image data (no data-URI prefix) */
  imageBase64: string;

  /** MIME type of the image */
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";

  /** The 4 expected bowler names with their database IDs */
  expectedBowlers: ExpectedBowler[];
}

// ============================================================================
// Output Types
// ============================================================================

export interface FrameData {
  frameNumber: number; // 1-10
  ball1Score: number; // 0-10
  ball2Score: number | null; // 0-10 or null (null if strike on frames 1-9)
  ball3Score: number | null; // only non-null on frame 10 if strike or spare
  isBall1Split: boolean;
}

export interface BowlerFrameData {
  /** Bowler name as read from the scorecard */
  bowlerName: string;

  /** Matched bowler ID from the expected bowlers list */
  matchedBowlerId: string;

  /** 10 frames of scoring data */
  frames: FrameData[];
}

export interface ScorecardAnalysisResult {
  success: boolean;
  confidence: AnalysisConfidence;
  bowlers: BowlerFrameData[];
  reasoning: string;
  processingTimeMs: number;
  errorMessage?: string;
}

// ============================================================================
// Claude Response Shape
// ============================================================================

export interface ClaudeScorecardResponse {
  bowler_verification: {
    detected_names: string[];
    matched: boolean;
    match_details: string;
  };
  frame_verification: {
    all_frames_readable: boolean;
    details: string;
  };
  bowlers: Array<{
    scorecard_name: string;
    matched_bowler_id: string;
    frames: Array<{
      frame_number: number;
      ball1_score: number;
      ball2_score: number | null;
      ball3_score: number | null;
      is_ball1_split: boolean;
    }>;
  }>;
  confidence: string;
  reasoning: string;
}
