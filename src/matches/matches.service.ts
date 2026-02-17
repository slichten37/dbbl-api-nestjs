import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma";
import { ScorecardAnalysisService } from "../scorecard-analysis";
import { CreateMatchDto } from "./dto/create-match.dto";
import { UpdateMatchDto } from "./dto/update-match.dto";
import { SubmitScoresDto } from "./dto/submit-scores.dto";
import type { ScorecardAnalysisInput } from "../scorecard-analysis";

const matchIncludes = {
  team1: {
    include: {
      bowlers: true,
    },
  },
  team2: {
    include: {
      bowlers: true,
    },
  },
  season: true,
  frames: {
    include: {
      bowler: true,
    },
    orderBy: [
      { bowlerId: "asc" as const },
      { frameNumber: "asc" as const },
    ],
  },
};

@Injectable()
export class MatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scorecardAnalysis: ScorecardAnalysisService,
  ) {}

  findAll() {
    return this.prisma.match.findMany({
      include: matchIncludes,
    });
  }

  async findOne(id: string) {
    const match = await this.prisma.match.findUnique({
      where: { id },
      include: matchIncludes,
    });
    if (!match) {
      throw new NotFoundException(`Match with id ${id} not found`);
    }
    return match;
  }

  create(dto: CreateMatchDto) {
    return this.prisma.match.create({
      data: dto,
      include: matchIncludes,
    });
  }

  async update(id: string, dto: UpdateMatchDto) {
    await this.findOne(id);
    return this.prisma.match.update({
      where: { id },
      data: dto,
      include: matchIncludes,
    });
  }

  async analyzeScorecard(id: string, file: Express.Multer.File) {
    const match = await this.findOne(id);

    const expectedBowlers = [
      ...match.team1.bowlers.map((b) => ({ id: b.id, name: b.name })),
      ...match.team2.bowlers.map((b) => ({ id: b.id, name: b.name })),
    ];

    const input: ScorecardAnalysisInput = {
      imageBase64: file.buffer.toString("base64"),
      mediaType: file.mimetype as ScorecardAnalysisInput["mediaType"],
      expectedBowlers,
    };

    return this.scorecardAnalysis.analyzeScorecard(input);
  }

  async submitScores(id: string, dto: SubmitScoresDto) {
    const match = await this.findOne(id);

    const team1BowlerIds = new Set(
      match.team1.bowlers.map((b) => b.id),
    );
    const team2BowlerIds = new Set(
      match.team2.bowlers.map((b) => b.id),
    );

    const upserts = dto.bowlers.flatMap((bowler) =>
      bowler.frames.map((frame) =>
        this.prisma.frame.upsert({
          where: {
            matchId_bowlerId_frameNumber: {
              matchId: id,
              bowlerId: bowler.bowlerId,
              frameNumber: frame.frameNumber,
            },
          },
          create: {
            matchId: id,
            bowlerId: bowler.bowlerId,
            frameNumber: frame.frameNumber,
            ball1Score: frame.ball1Score,
            ball2Score: frame.ball2Score,
            ball3Score: frame.ball3Score,
            isBall1Split: frame.isBall1Split,
          },
          update: {
            ball1Score: frame.ball1Score,
            ball2Score: frame.ball2Score,
            ball3Score: frame.ball3Score,
            isBall1Split: frame.isBall1Split,
          },
        }),
      ),
    );

    await this.prisma.$transaction(upserts);

    // Calculate team scores and strike counts from submitted frames
    let team1Score = 0;
    let team2Score = 0;
    let team1Strikes = 0;
    let team2Strikes = 0;

    for (const bowler of dto.bowlers) {
      const bowlerTotal = this.calculateBowlerTotal(bowler.frames);
      const bowlerStrikes = this.countStrikes(bowler.frames);

      if (team1BowlerIds.has(bowler.bowlerId)) {
        team1Score += bowlerTotal;
        team1Strikes += bowlerStrikes;
      } else if (team2BowlerIds.has(bowler.bowlerId)) {
        team2Score += bowlerTotal;
        team2Strikes += bowlerStrikes;
      }
    }

    const winningTeamId =
      team1Score > team2Score
        ? match.team1Id
        : team2Score > team1Score
          ? match.team2Id
          : null;

    await this.prisma.match.update({
      where: { id },
      data: {
        team1Score,
        team2Score,
        team1Strikes,
        team2Strikes,
        winningTeamId,
      },
    });

    return this.findOne(id);
  }

  private calculateBowlerTotal(
    frames: { frameNumber: number; ball1Score: number; ball2Score: number | null; ball3Score: number | null }[],
  ): number {
    const sorted = [...frames].sort((a, b) => a.frameNumber - b.frameNumber);
    let total = 0;

    for (let i = 0; i < sorted.length; i++) {
      const frame = sorted[i];
      const b1 = frame.ball1Score;
      const b2 = frame.ball2Score ?? 0;
      const b3 = frame.ball3Score ?? 0;

      if (frame.frameNumber === 10) {
        // 10th frame: just sum all balls
        total += b1 + b2 + b3;
      } else {
        const next = sorted[i + 1];
        const next2 = sorted[i + 2];

        if (b1 === 10) {
          // Strike
          total += 10;
          if (next) {
            total += next.ball1Score;
            if (next.ball1Score === 10 && next.frameNumber < 10) {
              // Next was also a strike, grab first ball of frame after that
              total += next2 ? next2.ball1Score : 0;
            } else {
              total += next.ball2Score ?? 0;
            }
          }
        } else if (b1 + b2 === 10) {
          // Spare
          total += 10;
          if (next) {
            total += next.ball1Score;
          }
        } else {
          total += b1 + b2;
        }
      }
    }

    return total;
  }

  private countStrikes(
    frames: { ball1Score: number; ball2Score: number | null; ball3Score: number | null; frameNumber: number }[],
  ): number {
    let count = 0;
    for (const frame of frames) {
      if (frame.ball1Score === 10) count++;
      // In the 10th frame, ball2 and ball3 can also be strikes
      if (frame.frameNumber === 10) {
        if (frame.ball2Score === 10) count++;
        if (frame.ball3Score === 10) count++;
      }
    }
    return count;
  }
}
