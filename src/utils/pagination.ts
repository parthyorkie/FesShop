export const getPaginationOptions = (reqQuery: any) => {
  const page = parseInt(reqQuery.page as string, 10) || 1;
  const limit = parseInt(reqQuery.limit as string, 10) || 10;
  
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

export const formatPaginationData = (total: number, page: number, limit: number) => {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
};
