export const createApiResponse = <T>(statusCode: number, data: T | null, message = 'Success', pagination?: object) => {
  return {
    success: statusCode < 400,
    statusCode,
    message,
    data,
    ...(pagination && { pagination })
  };
};
