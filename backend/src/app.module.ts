import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { AuthModule } from './modules/auth/auth.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { UsersModule } from './modules/users/users.module';
import { AiSettingsModule } from './modules/ai-settings/ai-settings.module';
import { AiChatModule } from './modules/ai-chat/ai-chat.module';
import { SkillsCompetencyModule } from './modules/skills-competency/skills-competency.module';
import { ActivityLogsModule } from './modules/activity-logs/activity-logs.module';
import { DevelopmentPlansModule } from './modules/development-plans/development-plans.module';
import { JobRequirementsModule } from './modules/job-requirements/job-requirements.module';
import { CompetencyProfileModule } from './modules/competency-profile/competency-profile.module';
import { ProfileImportsModule } from './modules/profile-imports/profile-imports.module';
import { AssessmentsModule } from './modules/assessments/assessments.module';
import { CareerPassportModule } from './modules/career-passport/career-passport.module';
import { AssistantModule } from './modules/assistant/assistant.module';
import { RolesModule } from './modules/roles/roles.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CryptoModule,
    // Real, backend-backed
    AuthModule,
    CompaniesModule,
    UsersModule,
    AiSettingsModule,
    AiChatModule,
    // Stub modules — one per remaining Prisma schema domain, see each
    // module's own controller for the "not-implemented" placeholder route.
    SkillsCompetencyModule,
    ActivityLogsModule,
    DevelopmentPlansModule,
    JobRequirementsModule,
    // CareerMate slice — see docs/careermate-scope.md for what each covers.
    CompetencyProfileModule,
    ProfileImportsModule,
    AssessmentsModule,
    CareerPassportModule,
    AssistantModule,
    RolesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
