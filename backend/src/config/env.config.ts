export interface EnvironmentVariables {
  PORT: number;
  NODE_ENV: string;
  DATABASE_URL: string;
  TELEGRAM_BOT_TOKEN: string;
  GROQ_API_KEY: string;
  GROQ_MODEL: string;
}

export const validateEnv = (
  config: Record<string, unknown>,
): EnvironmentVariables => {
  const PORT = Number(config.PORT || 3001);
  const NODE_ENV = (config.NODE_ENV as string) || 'development';

  const DATABASE_URL = config.DATABASE_URL as string;
  const TELEGRAM_BOT_TOKEN = config.TELEGRAM_BOT_TOKEN as string;

  const GROQ_API_KEY = config.GROQ_API_KEY as string;
  const GROQ_MODEL =
    (config.GROQ_MODEL as string) || 'llama-3.3-70b-versatile';

  const missingVars: string[] = [];

  if (!DATABASE_URL && NODE_ENV !== 'test') {
    missingVars.push('DATABASE_URL');
  }

  if (!TELEGRAM_BOT_TOKEN && NODE_ENV !== 'test') {
    missingVars.push('TELEGRAM_BOT_TOKEN');
  }

  if (!GROQ_API_KEY && NODE_ENV !== 'test') {
    missingVars.push('GROQ_API_KEY');
  }

  if (missingVars.length > 0 && NODE_ENV === 'production') {
    throw new Error(
      `[ConfigError] Critical environment variables are missing: ${missingVars.join(
        ', ',
      )}. Application cannot start.`,
    );
  } else if (missingVars.length > 0) {
    console.warn(
      `[ConfigWarning] Missing environment variables: ${missingVars.join(
        ', ',
      )}. Features relying on missing services will operate in fallback mode.`,
    );
  }

  return {
    PORT,
    NODE_ENV,
    DATABASE_URL,
    TELEGRAM_BOT_TOKEN,
    GROQ_API_KEY,
    GROQ_MODEL,
  };
};