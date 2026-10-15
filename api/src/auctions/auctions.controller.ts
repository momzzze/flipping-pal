import { parsePositiveInt } from '../common/query';
import {
  Controller,
  Get,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { AuctionsService } from './auctions.service';

@Controller()
export class AuctionsController {
  constructor(private readonly auctions: AuctionsService) {}

  @Post('auctions/commodities/refresh')
  refreshCommodities(
    @Query('force', new ParseBoolPipe({ optional: true })) force?: boolean,
  ) {
    return this.auctions.refreshCommodities(force ?? false);
  }

  @Post('auctions/realms/:connectedRealmId/refresh')
  refreshRealm(
    @Param('connectedRealmId', ParseIntPipe) connectedRealmId: number,
    @Query('force', new ParseBoolPipe({ optional: true })) force?: boolean,
  ) {
    return this.auctions.refreshRealm(connectedRealmId, force ?? false);
  }

  @Get('auctions/snapshots')
  listSnapshots(@Query('limit') limit?: string) {
    return this.auctions.listSnapshots(parsePositiveInt(limit, 50));
  }

  @Get('connected-realms')
  listConnectedRealms() {
    return this.auctions.listConnectedRealms();
  }

  @Post('connected-realms/sync')
  syncConnectedRealms() {
    return this.auctions.syncConnectedRealms();
  }
}
