import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma";
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
  constructor(private readonly prisma: PrismaService) {}

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
}
