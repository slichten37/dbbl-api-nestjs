import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma";
import { MatchesService } from "../matches/matches.service";
import { CreateSeasonDto } from "./dto/create-season.dto";
import { UpdateSeasonDto } from "./dto/update-season.dto";

const seasonIncludes = {
  teams: {
    include: {
      bowlers: true,
    },
  },
  matches: {
    include: {
      homeTeam: true,
      awayTeam: true,
    },
  },
};

@Injectable()
export class SeasonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matchesService: MatchesService,
  ) {}

  findAll() {
    return this.prisma.season.findMany({
      include: seasonIncludes,
    });
  }

  async findActive() {
    const season = await this.prisma.season.findFirst({
      where: { isActive: true },
      include: seasonIncludes,
    });
    if (!season) {
      throw new NotFoundException("No active season found");
    }
    return season;
  }

  async findOne(id: string) {
    const season = await this.prisma.season.findUnique({
      where: { id },
      include: seasonIncludes,
    });
    if (!season) {
      throw new NotFoundException(`Season with id ${id} not found`);
    }
    return season;
  }

  create(dto: CreateSeasonDto) {
    const { teamIds, isActive, ...rest } = dto;
    return this.prisma.season.create({
      data: {
        ...rest,
        isActive: isActive ?? false,
        teams: teamIds?.length
          ? { connect: teamIds.map((id) => ({ id })) }
          : undefined,
      },
      include: seasonIncludes,
    });
  }

  async update(id: string, dto: UpdateSeasonDto) {
    await this.findOne(id);
    const { teamIds, isActive, ...rest } = dto;
    return this.prisma.season.update({
      where: { id },
      data: {
        ...rest,
        ...(isActive !== undefined && { isActive }),
        teams: teamIds ? { set: teamIds.map((id) => ({ id })) } : undefined,
      },
      include: seasonIncludes,
    });
  }

  async generateSchedule(id: string) {
    const season = await this.prisma.season.findUnique({
      where: { id },
      include: { teams: true, matches: true },
    });
    if (!season) {
      throw new NotFoundException(`Season with id ${id} not found`);
    }
    if (season.teams.length < 2) {
      throw new BadRequestException(
        "Season must have at least 2 teams to generate a schedule",
      );
    }
    if (season.matches.length > 0) {
      throw new BadRequestException(
        "Season already has matches. Remove existing matches before regenerating.",
      );
    }

    const teamIds = season.teams.map((t) => t.id);
    const matches = this.buildRoundRobin(teamIds);

    await this.prisma.match.createMany({
      data: matches.map((m) => ({
        seasonId: id,
        homeTeamId: m.homeTeamId,
        awayTeamId: m.awayTeamId,
        week: m.week,
      })),
    });

    return this.findOne(id);
  }

  private buildRoundRobin(
    teamIds: string[],
  ): { homeTeamId: string; awayTeamId: string; week: number }[] {
    const teams = [...teamIds];
    const hasBye = teams.length % 2 !== 0;
    if (hasBye) {
      teams.push("BYE");
    }

    const n = teams.length;
    const rounds = n - 1;
    const half = n / 2;
    const matches: { homeTeamId: string; awayTeamId: string; week: number }[] =
      [];

    // Standard round-robin: fix teams[0], rotate the rest
    const rotating = teams.slice(1);

    for (let round = 0; round < rounds; round++) {
      const week = round + 1;
      const current = [teams[0], ...rotating];

      for (let i = 0; i < half; i++) {
        const home = current[i];
        const away = current[n - 1 - i];
        if (home !== "BYE" && away !== "BYE") {
          matches.push({ homeTeamId: home, awayTeamId: away, week });
        }
      }

      // Rotate: move last element to the front of rotating array
      rotating.unshift(rotating.pop()!);
    }

    return matches;
  }

  async getStats(id: string) {
    const season = await this.prisma.season.findUnique({
      where: { id },
      include: {
        teams: { include: { bowlers: true } },
        matches: {
          include: {
            homeTeam: { include: { bowlers: true } },
            awayTeam: { include: { bowlers: true } },
            games: {
              include: {
                frames: true,
              },
            },
            substitutions: true,
          },
        },
      },
    });

    if (!season) {
      throw new NotFoundException(`Season with id ${id} not found`);
    }

    // Build bowler → team mapping including substitutions
    // For each match, a substitute bowler counts toward the team of their original bowler
    const bowlerStats = new Map<
      string,
      {
        id: string;
        name: string;
        gamesPlayed: number;
        pins: number;
        strikes: number;
        spares: number;
        gutters: number;
      }
    >();

    const teamStats = new Map<
      string,
      {
        id: string;
        name: string;
        matchWins: number;
        matchLosses: number;
        matchTies: number;
        gameWins: number;
        gameLosses: number;
        gameTies: number;
        gamesPlayed: number;
        pins: number;
        pinsAgainst: number;
        strikes: number;
        spares: number;
        gutters: number;
      }
    >();

    // Initialize team stats
    for (const team of season.teams) {
      teamStats.set(team.id, {
        id: team.id,
        name: team.name,
        matchWins: 0,
        matchLosses: 0,
        matchTies: 0,
        gameWins: 0,
        gameLosses: 0,
        gameTies: 0,
        gamesPlayed: 0,
        pins: 0,
        pinsAgainst: 0,
        strikes: 0,
        spares: 0,
        gutters: 0,
      });
    }

    for (const match of season.matches) {
      // Build bowlerId → teamId map for this match, including subs
      const bowlerToTeam = new Map<string, string>();
      for (const b of match.homeTeam.bowlers) {
        bowlerToTeam.set(b.id, match.homeTeamId);
      }
      for (const b of match.awayTeam.bowlers) {
        bowlerToTeam.set(b.id, match.awayTeamId);
      }
      for (const sub of match.substitutions) {
        // Sub bowler counts toward the team of the original bowler
        if (bowlerToTeam.has(sub.originalBowlerId)) {
          bowlerToTeam.set(
            sub.substituteBowlerId,
            bowlerToTeam.get(sub.originalBowlerId)!,
          );
        }
      }

      // Count match win/loss/tie
      if (match.winningTeamId) {
        const winTs = teamStats.get(match.winningTeamId);
        if (winTs) winTs.matchWins++;

        const losingTeamId =
          match.winningTeamId === match.homeTeamId
            ? match.awayTeamId
            : match.homeTeamId;
        const loseTs = teamStats.get(losingTeamId);
        if (loseTs) loseTs.matchLosses++;
      } else if (
        match.games.length > 0 &&
        match.games.every((g) => g.homeTeamScore != null)
      ) {
        // No winner but all games submitted → tie
        const homeTs = teamStats.get(match.homeTeamId);
        if (homeTs) homeTs.matchTies++;
        const awayTs = teamStats.get(match.awayTeamId);
        if (awayTs) awayTs.matchTies++;
      }

      for (const game of match.games) {
        // Count game wins/losses/ties
        if (game.homeTeamScore != null && game.awayTeamScore != null) {
          if (game.homeTeamScore > game.awayTeamScore) {
            const winTs = teamStats.get(match.homeTeamId);
            if (winTs) winTs.gameWins++;
            const loseTs = teamStats.get(match.awayTeamId);
            if (loseTs) loseTs.gameLosses++;
          } else if (game.awayTeamScore > game.homeTeamScore) {
            const winTs = teamStats.get(match.awayTeamId);
            if (winTs) winTs.gameWins++;
            const loseTs = teamStats.get(match.homeTeamId);
            if (loseTs) loseTs.gameLosses++;
          } else {
            const homeTs = teamStats.get(match.homeTeamId);
            if (homeTs) homeTs.gameTies++;
            const awayTs = teamStats.get(match.awayTeamId);
            if (awayTs) awayTs.gameTies++;
          }
        }

        // Track gamesPlayed per team (each submitted game counts once per team)
        if (game.homeTeamScore != null) {
          const homeTs = teamStats.get(match.homeTeamId);
          if (homeTs) homeTs.gamesPlayed++;
          const awayTs = teamStats.get(match.awayTeamId);
          if (awayTs) awayTs.gamesPlayed++;
        }

        // Track which bowlers participated in this game
        const bowlersInGame = new Set<string>();

        // Process frames
        for (const frame of game.frames) {
          bowlersInGame.add(frame.bowlerId);
          // Ensure bowler stat entry exists
          if (!bowlerStats.has(frame.bowlerId)) {
            // We need the bowler name — look it up from team rosters or subs
            let bowlerName = "Unknown";
            for (const b of [
              ...match.homeTeam.bowlers,
              ...match.awayTeam.bowlers,
            ]) {
              if (b.id === frame.bowlerId) {
                bowlerName = b.name;
                break;
              }
            }
            // Check if this is a sub bowler
            if (bowlerName === "Unknown") {
              const bowler = await this.prisma.bowler.findUnique({
                where: { id: frame.bowlerId },
              });
              if (bowler) bowlerName = bowler.name;
            }
            bowlerStats.set(frame.bowlerId, {
              id: frame.bowlerId,
              name: bowlerName,
              gamesPlayed: 0,
              pins: 0,
              strikes: 0,
              spares: 0,
              gutters: 0,
            });
          }

          const bs = bowlerStats.get(frame.bowlerId)!;
          const teamId = bowlerToTeam.get(frame.bowlerId);
          const ts = teamId ? teamStats.get(teamId) : null;

          const b1 = frame.ball1Score;
          const b2 = frame.ball2Score ?? 0;
          const b3 = frame.ball3Score ?? 0;

          // Total pins (raw pin count, not bonus-adjusted)
          const framePins = b1 + b2 + b3;
          bs.pins += framePins;
          if (ts) ts.pins += framePins;

          // Pins against: attribute to the opposing team
          if (teamId) {
            const opponentTeamId =
              teamId === match.homeTeamId ? match.awayTeamId : match.homeTeamId;
            const opTs = teamStats.get(opponentTeamId);
            if (opTs) opTs.pinsAgainst += framePins;
          }

          // Strikes
          if (b1 === 10) {
            bs.strikes++;
            if (ts) ts.strikes++;
          }
          // 10th frame extra strikes
          if (frame.frameNumber === 10) {
            if (frame.ball2Score === 10) {
              bs.strikes++;
              if (ts) ts.strikes++;
            }
            if (frame.ball3Score === 10) {
              bs.strikes++;
              if (ts) ts.strikes++;
            }
          }

          // Spares (non-strike where b1+b2=10)
          if (frame.frameNumber < 10) {
            if (b1 !== 10 && b1 + b2 === 10) {
              bs.spares++;
              if (ts) ts.spares++;
            }
          } else {
            // 10th frame spares
            if (b1 !== 10 && b1 + b2 === 10) {
              bs.spares++;
              if (ts) ts.spares++;
            }
            // After a strike on b1, check if b2+b3 is a spare
            if (b1 === 10 && frame.ball2Score !== 10 && b2 + b3 === 10) {
              bs.spares++;
              if (ts) ts.spares++;
            }
          }

          // Gutters (ball score of 0, excluding nulls)
          if (b1 === 0) {
            bs.gutters++;
            if (ts) ts.gutters++;
          }
          if (frame.ball2Score === 0) {
            bs.gutters++;
            if (ts) ts.gutters++;
          }
          if (frame.ball3Score === 0) {
            bs.gutters++;
            if (ts) ts.gutters++;
          }
        }

        // Increment gamesPlayed for each bowler who had frames in this game
        for (const bowlerId of bowlersInGame) {
          const bs = bowlerStats.get(bowlerId);
          if (bs) bs.gamesPlayed++;
        }
      }
    }

    // Convert raw totals to per-game averages
    const round2 = (n: number) => Math.round(n * 100) / 100;

    return {
      bowlers: Array.from(bowlerStats.values()).map((b) => {
        const g = b.gamesPlayed || 1;
        return {
          id: b.id,
          name: b.name,
          gamesPlayed: b.gamesPlayed,
          ppg: round2(b.pins / g),
          spg: round2(b.strikes / g),
          sparespg: round2(b.spares / g),
          gpg: round2(b.gutters / g),
        };
      }),
      teams: Array.from(teamStats.values()).map((t) => {
        const g = t.gamesPlayed || 1;
        return {
          id: t.id,
          name: t.name,
          matchWins: t.matchWins,
          matchLosses: t.matchLosses,
          matchTies: t.matchTies,
          gameWins: t.gameWins,
          gameLosses: t.gameLosses,
          gameTies: t.gameTies,
          gamesPlayed: t.gamesPlayed,
          ppg: round2(t.pins / g),
          oppg: round2(t.pinsAgainst / g),
          spg: round2(t.strikes / g),
          sparespg: round2(t.spares / g),
          gpg: round2(t.gutters / g),
        };
      }),
    };
  }

  async autoFillWeek(seasonId: string, week: number) {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
      include: {
        matches: {
          where: { week },
          include: {
            homeTeam: { include: { bowlers: true } },
            awayTeam: { include: { bowlers: true } },
            substitutions: true,
          },
        },
      },
    });

    if (!season) {
      throw new NotFoundException(`Season with id ${seasonId} not found`);
    }

    if (season.matches.length === 0) {
      throw new BadRequestException(`No matches found for week ${week}`);
    }

    for (const match of season.matches) {
      // Build active bowler list (accounting for subs)
      const subMap = new Map<string, string>();
      for (const sub of match.substitutions) {
        subMap.set(sub.originalBowlerId, sub.substituteBowlerId);
      }

      const activeBowlerIds = [
        ...match.homeTeam.bowlers.map((b) => subMap.get(b.id) ?? b.id),
        ...match.awayTeam.bowlers.map((b) => subMap.get(b.id) ?? b.id),
      ];

      // Generate and submit scores for all 3 games
      for (let gameNumber = 1; gameNumber <= 3; gameNumber++) {
        const bowlers = activeBowlerIds.map((bowlerId) => ({
          bowlerId,
          frames: this.generateRandomFrames(),
        }));

        await this.matchesService.submitScores(match.id, {
          gameNumber,
          bowlers,
        });
      }
    }

    return this.findOne(seasonId);
  }

  private generateRandomFrames() {
    const frames: {
      frameNumber: number;
      ball1Score: number;
      ball2Score: number | null;
      ball3Score: number | null;
      isBall1Split: boolean;
    }[] = [];

    for (let f = 1; f <= 10; f++) {
      if (f < 10) {
        const ball1 = this.randomBall1();
        let ball2: number | null = null;
        if (ball1 < 10) {
          ball2 = this.weightedRandom(10 - ball1);
        }
        frames.push({
          frameNumber: f,
          ball1Score: ball1,
          ball2Score: ball2,
          ball3Score: null,
          isBall1Split: false,
        });
      } else {
        // 10th frame
        const ball1 = this.randomBall1();
        let ball2: number | null = null;
        let ball3: number | null = null;

        if (ball1 === 10) {
          // Strike on ball1 → bowl 2 more
          ball2 = this.randomBall1();
          if (ball2 === 10) {
            ball3 = this.randomBall1();
          } else {
            ball3 = this.weightedRandom(10 - ball2);
          }
        } else {
          ball2 = this.weightedRandom(10 - ball1);
          if (ball1 + (ball2 ?? 0) === 10) {
            // Spare → bowl one more
            ball3 = this.randomBall1();
          }
        }

        frames.push({
          frameNumber: f,
          ball1Score: ball1,
          ball2Score: ball2,
          ball3Score: ball3,
          isBall1Split: false,
        });
      }
    }

    return frames;
  }

  /** Weighted first ball: biased toward higher scores for realism */
  private randomBall1(): number {
    const r = Math.random();
    // ~15% strike, ~15% 9, ~15% 8, ~12% 7, ~10% 6, ~8% 5, ~25% 0-4
    if (r < 0.15) return 10;
    if (r < 0.3) return 9;
    if (r < 0.45) return 8;
    if (r < 0.57) return 7;
    if (r < 0.67) return 6;
    if (r < 0.75) return 5;
    return Math.floor(Math.random() * 5); // 0-4
  }

  /** Weighted second/third ball within remaining pins */
  private weightedRandom(max: number): number {
    if (max <= 0) return 0;
    // Bias toward knocking down remaining pins (spare attempt)
    const r = Math.random();
    if (r < 0.3) return max; // 30% chance of spare/clearing remaining
    if (r < 0.55) return Math.max(0, max - 1);
    return Math.floor(Math.random() * (max + 1));
  }
}
