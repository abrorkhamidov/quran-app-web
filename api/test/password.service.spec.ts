import { PasswordService } from '../src/auth/password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes a password to a non-plaintext string', async () => {
    const hash = await service.hash('s3cret!');
    expect(hash).not.toBe('s3cret!');
    expect(hash.length).toBeGreaterThan(20);
  });

  it('verifies a correct password', async () => {
    const hash = await service.hash('s3cret!');
    expect(await service.verify(hash, 's3cret!')).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await service.hash('s3cret!');
    expect(await service.verify(hash, 'wrong')).toBe(false);
  });
});
