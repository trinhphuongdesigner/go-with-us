import { Module } from '@nestjs/common';
import { PeerReviewsController } from './peer-reviews.controller';
import { PeerReviewsService } from './peer-reviews.service';

@Module({
  controllers: [PeerReviewsController],
  providers: [PeerReviewsService],
})
export class PeerReviewsModule {}
