import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma";
import { CreateTeamDto } from "./dto/create-team.dto";
import { UpdateTeamDto } from "./dto/update-team.dto";

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.team.findMany({
      include: { bowlers: true, seasons: true },
    });
  }

  async findOne(id: string) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: { bowlers: true, seasons: true },
    });
    if (!team) {
      throw new NotFoundException(`Team with id ${id} not found`);
    }
    return team;
  }

  create(dto: CreateTeamDto) {
    const { bowlerIds, ...rest } = dto;
    return this.prisma.team.create({
      data: {
        ...rest,
        bowlers: bowlerIds?.length
          ? { connect: bowlerIds.map((id) => ({ id })) }
          : undefined,
      },
      include: { bowlers: true, seasons: true },
    });
  }

  async update(id: string, dto: UpdateTeamDto) {
    await this.findOne(id);
    const { bowlerIds, ...rest } = dto;
    return this.prisma.team.update({
      where: { id },
      data: {
        ...rest,
        bowlers: bowlerIds
          ? { set: bowlerIds.map((id) => ({ id })) }
          : undefined,
      },
      include: { bowlers: true, seasons: true },
    });
  }
}
