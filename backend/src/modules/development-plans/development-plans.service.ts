import { Injectable } from '@nestjs/common';

@Injectable()
export class DevelopmentPlansService {
  status() {
    return { status: 'not-implemented' };
  }
}
