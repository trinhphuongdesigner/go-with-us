import { Global, Module } from '@nestjs/common';
import { CryptoService } from './crypto.service';

/** Global — imported once in AppModule, injectable anywhere after that. */
@Global()
@Module({
  providers: [CryptoService],
  exports: [CryptoService],
})
export class CryptoModule {}
