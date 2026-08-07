export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  timestamp: string;
}

export const createApiResponse = <T>(
  success: boolean,
  message: string,
  data?: T,
  error?: string,
): ApiResponse<T> => {
  return {
    success,
    message,
    data,
    error,
    timestamp: new Date().toISOString(),
  };
};
