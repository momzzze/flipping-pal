export class BlizzardCredentialsMissingError extends Error {
  constructor() {
    super(
      'Blizzard API credentials are not configured. Set BLIZZARD_CLIENT_ID and BLIZZARD_CLIENT_SECRET in api/.env, or load the explicitly-labeled sample data.',
    );
    this.name = 'BlizzardCredentialsMissingError';
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
