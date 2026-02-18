import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma";
import { ScorecardAnalysisService } from "../scorecard-analysis";
import { CreateMatchDto } from "./dto/create-match.dto";
import { UpdateMatchDto } from "./dto/update-match.dto";
import { SubmitScoresDto } from "./dto/submit-scores.dto";
import { CreateSubstitutionDto } from "./dto/create-substitution.dto";
import type { ScorecardAnalysisInput } from "../scorecard-analysis";

const matchIncludes = {
  homeTeam: {
    include: {
      bowlers: true,
    },
  },
  awayTeam: {
    include: {
      bowlers: true,
    },
  },
  season: true,
  games: {
    include: {
      frames: {
        include: {
          bowler: true,
        },
        orderBy: [
          { bowlerId: "asc" as const },
          { frameNumber: "asc" as const },
        ],
      },
    },
    orderBy: {
      gameNumber: "asc" as const,
    },
  },
  substitutions: {
    include: {
      originalBowler: true,
      substituteBowler: true,
      team: true,
    },
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

    // Build a map of originalBowlerId -> substituteBowler for active subs
    const subMap = new Map<string, { id: string; name: string }>();
    for (const sub of match.substitutions) {
      subMap.set(sub.originalBowlerId, {
        id: sub.substituteBowler.id,
        name: sub.substituteBowler.name,
      });
    }

    const expectedBowlers = [
      ...match.homeTeam.bowlers.map((b) => {
        const replacement = subMap.get(b.id);
        return replacement
          ? { id: replacement.id, name: replacement.name }
          : { id: b.id, name: b.name };
      }),
      ...match.awayTeam.bowlers.map((b) => {
        const replacement = subMap.get(b.id);
        return replacement
          ? { id: replacement.id, name: replacement.name }
          : { id: b.id, name: b.name };
      }),
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

    const homeTeamBowlerIds = new Set(match.homeTeam.bowlers.map((b) => b.id));
    const awayTeamBowlerIds = new Set(match.awayTeam.bowlers.map((b) => b.id));

    // Add substitute bowlers to the correct team set
    for (const sub of match.substitutions) {
      if (homeTeamBowlerIds.has(sub.originalBowlerId)) {
        homeTeamBowlerIds.add(sub.substituteBowlerId);
      } else if (awayTeamBowlerIds.has(sub.originalBowlerId)) {
        awayTeamBowlerIds.add(sub.substituteBowlerId);
      }
    }

    // Find or create the Game record for this gameNumber
    const game = await this.prisma.game.upsert({
      where: {
        matchId_gameNumber: {
          matchId: id,
          gameNumber: dto.gameNumber,
        },
      },
      create: {
        matchId: id,
        gameNumber: dto.gameNumber,
      },
      update: {},
    });

    // Upsert all frames for this game
    const upserts = dto.bowlers.flatMap((bowler) =>
      bowler.frames.map((frame) =>
        this.prisma.frame.upsert({
          where: {
            gameId_bowlerId_frameNumber: {
              gameId: game.id,
              bowlerId: bowler.bowlerId,
              frameNumber: frame.frameNumber,
            },
          },
          create: {
            gameId: game.id,
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

    // Calculate per-game team scores and strike counts
    let homeTeamScore = 0;
    let awayTeamScore = 0;
    let homeTeamStrikes = 0;
    let awayTeamStrikes = 0;

    for (const bowler of dto.bowlers) {
      const bowlerTotal = this.calculateBowlerTotal(bowler.frames);
      const bowlerStrikes = this.countStrikes(bowler.frames);

      if (homeTeamBowlerIds.has(bowler.bowlerId)) {
        homeTeamScore += bowlerTotal;
        homeTeamStrikes += bowlerStrikes;
      } else if (awayTeamBowlerIds.has(bowler.bowlerId)) {
        awayTeamScore += bowlerTotal;
        awayTeamStrikes += bowlerStrikes;
      }
    }

    // Calculate per-game points:
    // Winner gets 10 + their strikes, loser gets their strikes, tie gives 5 + strikes each
    let homeTeamPoints: number;
    let awayTeamPoints: number;

    if (homeTeamScore > awayTeamScore) {
      homeTeamPoints = 10 + homeTeamStrikes;
      awayTeamPoints = awayTeamStrikes;
    } else if (awayTeamScore > homeTeamScore) {
      homeTeamPoints = homeTeamStrikes;
      awayTeamPoints = 10 + awayTeamStrikes;
    } else {
      // Tie
      homeTeamPoints = 5 + homeTeamStrikes;
      awayTeamPoints = 5 + awayTeamStrikes;
    }

    // Update the Game record with scores, strikes, and points
    await this.prisma.game.update({
      where: { id: game.id },
      data: {
        homeTeamScore,
        awayTeamScore,
        homeTeamStrikes,
        awayTeamStrikes,
        homeTeamPoints,
        awayTeamPoints,
      },
    });

    // Recompute match-level aggregate points across all submitted games
    const allGames = await this.prisma.game.findMany({
      where: { matchId: id },
    });

    const totalHomePoints = allGames.reduce(
      (sum, g) => sum + (g.homeTeamPoints ?? 0),
      0,
    );
    const totalAwayPoints = allGames.reduce(
      (sum, g) => sum + (g.awayTeamPoints ?? 0),
      0,
    );

    const winningTeamId =
      totalHomePoints > totalAwayPoints
        ? match.homeTeamId
        : totalAwayPoints > totalHomePoints
          ? match.awayTeamId
          : null;

    await this.prisma.match.update({
      where: { id },
      data: {
        homeTeamPoints: totalHomePoints,
        awayTeamPoints: totalAwayPoints,
        winningTeamId,
      },
    });

    return this.findOne(id);
  }

  async createSubstitution(matchId: string, dto: CreateSubstitutionDto) {
    const match = await this.findOne(matchId);

    // Validate teamId is one of the match teams
    if (dto.teamId !== match.homeTeamId && dto.teamId !== match.awayTeamId) {
      throw new BadRequestException(
        "Team must be one of the teams in this match",
      );
    }

    // Validate originalBowler belongs to the specified team
    const team =
      dto.teamId === match.homeTeamId ? match.homeTeam : match.awayTeam;
    const isOnTeam = team.bowlers.some((b) => b.id === dto.originalBowlerId);
    if (!isOnTeam) {
      throw new BadRequestException(
        "Original bowler must be a member of the specified team",
      );
    }

    // Validate substituteBowler is not on either team
    const allTeamBowlerIds = [
      ...match.homeTeam.bowlers.map((b) => b.id),
      ...match.awayTeam.bowlers.map((b) => b.id),
    ];
    if (allTeamBowlerIds.includes(dto.substituteBowlerId)) {
      throw new BadRequestException(
        "Substitute bowler must not be on either team in this match",
      );
    }

    await this.prisma.matchSubstitution.create({
      data: {
        matchId,
        originalBowlerId: dto.originalBowlerId,
        substituteBowlerId: dto.substituteBowlerId,
        teamId: dto.teamId,
      },
    });

    return this.findOne(matchId);
  }

  async deleteSubstitution(matchId: string, substitutionId: string) {
    const sub = await this.prisma.matchSubstitution.findUnique({
      where: { id: substitutionId },
    });
    if (!sub || sub.matchId !== matchId) {
      throw new NotFoundException("Substitution not found for this match");
    }

    await this.prisma.matchSubstitution.delete({
      where: { id: substitutionId },
    });

    return this.findOne(matchId);
  }

  private calculateBowlerTotal(
    frames: {
      frameNumber: number;
      ball1Score: number;
      ball2Score: number | null;
      ball3Score: number | null;
    }[],
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
    frames: {
      ball1Score: number;
      ball2Score: number | null;
      ball3Score: number | null;
      frameNumber: number;
    }[],
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
