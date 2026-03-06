import * as bcrypt from 'bcrypt';

export async function hashPassword(
  plainPassword: string,
  rounds: number,
): Promise<string> {
  return await bcrypt.hash(plainPassword, rounds);
}

export async function verifyPassword(
  plainPassword: string,
  hashedPassword: string,
): Promise<boolean> {
  return await bcrypt.compare(plainPassword, hashedPassword);
}
