import { Injectable } from '@nestjs/common';
import { FederationStatus } from '@prisma/client';
import { FederationRepository } from './federation.repository';
import { CreateFederationDto } from './dto/create-federation.dto';

@Injectable()
export class FederationService {
  constructor(private readonly repository: FederationRepository) {}

  create(dto: CreateFederationDto) {
    return this.repository.create({
      name: dto.name,
      country: dto.country,
      sport: dto.sport,
      registrationNumber: dto.registrationNumber,
      status: FederationStatus.ACTIVE,
    });
  }

  list() {
    return this.repository.list();
  }
}
