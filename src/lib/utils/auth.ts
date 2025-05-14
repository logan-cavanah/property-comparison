// Authentication utilities and error handling

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export function validateUserId(userId: string) {
  if (!userId || typeof userId !== 'string') {
    throw new AuthError('Invalid user ID');
  }
}
