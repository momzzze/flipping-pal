export class BlizzardCredentialsMissingError extends Error {
  constructor() {
    super(
      'Blizzard API credentials are not configured. Set BLIZZARD_CLIENT_ID and BLIZZARD_CLIENT_SECRET in api/.env, or load the explicitly-labeled sample data.',
    );
    this.name = 'BlizzardCredentialsMissingError';
  }
}

export class BlizzardTargetUnsupportedError extends Error {
  constructor() {
    super(
      'Blizzard Retail data is disabled in Classic Forever mode. Import a Classic Forever catalog and use its scan data instead.',
    );
    this.name = 'BlizzardTargetUnsupportedError';
  }
}

export class BlizzardApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
  ) {
    super(message);
    this.name = 'BlizzardApiError';
  }
}
